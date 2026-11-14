import "server-only";

import type { TransactionOptions } from "mongodb";
import type { ClientSession } from "mongoose";

import type { RepertoireRecord } from "@/features/repertoires/domain/repertoire";
import type { SongRecord } from "@/features/songs/domain/song";
import {
  LibraryImportModel,
  type LibraryImportDocument,
} from "@/server/database/models/library-import-model";
import { LibraryError } from "@/features/library/domain/library-errors";
import { CatalogSongModel } from "@/server/database/models/catalog-song-model";
import { RepertoireModel, type RepertoireDocument } from "@/server/database/models/repertoire-model";
import { SongModel, type SongDocument } from "@/server/database/models/song-model";
import { ensureLibraryState, reserveLibraryState } from "@/server/repositories/library-state";
import {
  runPersistence,
  runTransaction,
  type OwnerContext,
} from "@/server/repositories/persistence";

import type { LibraryImportRecord, LibraryImportStore, LibraryImportTransaction } from "./library-import-service";

/** Lê um retrato consistente e só confirma quando a maioria gravou em disco. */
const IMPORT_TRANSACTION_OPTIONS: TransactionOptions = {
  readPreference: "primary",
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority", journal: true },
};

function toSongDocument(song: SongRecord, ownerId: string): SongDocument {
  const { id, title, artist, originalKey, contentType } = song;

  return {
    id,
    ownerId,
    title,
    artist,
    originalKey,
    contentType,
    ...(song.contentType === "external-link" ? { sourceUrl: song.sourceUrl } : {}),
    ...(song.contentType !== "external-link" && song.chordPro !== undefined
      ? { chordPro: song.chordPro }
      : {}),
    referenceVersion: 0,
    // Backups não têm revisão: todo documento importado começa na primeira.
    revision: 1,
    createdAt: new Date(song.createdAt),
    updatedAt: new Date(song.updatedAt),
  };
}

function toRepertoireDocument(repertoire: RepertoireRecord, ownerId: string): RepertoireDocument {
  return {
    ...repertoire,
    ownerId,
    revision: 1,
    createdAt: new Date(repertoire.createdAt),
    updatedAt: new Date(repertoire.updatedAt),
  };
}

function toRecord(document: LibraryImportDocument): LibraryImportRecord {
  const { importId, contentHash, schemaVersion, songs, repertoires, items, completedAt } = document;
  return { importId, contentHash, schemaVersion, songs, repertoires, items, completedAt };
}

export function createMongoLibraryImportStore({ ownerId }: OwnerContext): LibraryImportStore {
  function createTransaction(session: ClientSession): LibraryImportTransaction {
    return {
      async findRecord(importId) {
        const document = await LibraryImportModel.findOne({ ownerId, importId })
          .session(session)
          .lean();
        return document ? toRecord(document) : null;
      },

      reserveLibrary: () => reserveLibraryState(ownerId, session),

      async isLibraryEmpty() {
        // Em sequência: uma sessão não admite operações paralelas na mesma transação.
        const song = await SongModel.exists({ ownerId }).session(session);
        const repertoire = await RepertoireModel.exists({ ownerId }).session(session);
        return song === null && repertoire === null;
      },

      async insertLibrary(library) {
        // O backup só guarda a referência: a música do catálogo precisa continuar acessível.
        const catalogIds = [
          ...new Set(
            library.repertoires.flatMap((repertoire) =>
              repertoire.items.filter((item) => item.source === "catalog").map((item) => item.songId),
            ),
          ),
        ];
        if (catalogIds.length > 0) {
          const available = await CatalogSongModel.countDocuments({
            id: { $in: catalogIds },
            status: "published",
          }).session(session);
          if (available !== catalogIds.length) {
            throw new LibraryError(
              "invalid-data",
              "O backup usa músicas do catálogo que não estão mais disponíveis. Nada foi importado.",
            );
          }
        }

        await SongModel.insertMany(
          library.songs.map((song) => toSongDocument(song, ownerId)),
          { session, ordered: true },
        );
        await RepertoireModel.insertMany(
          library.repertoires.map((repertoire) => toRepertoireDocument(repertoire, ownerId)),
          { session, ordered: true },
        );
      },

      async saveRecord(record) {
        await LibraryImportModel.create([{ ...record, ownerId }], { session });
      },
    };
  }

  return {
    async transaction(work) {
      await ensureLibraryState(ownerId);
      return runTransaction((session) => work(createTransaction(session)), IMPORT_TRANSACTION_OPTIONS);
    },

    findRecord: (importId) =>
      runPersistence(async () => {
        const document = await LibraryImportModel.findOne({ ownerId, importId }).lean();
        return document ? toRecord(document) : null;
      }),

    countRemote: () =>
      runPersistence(async () => {
        const songs = await SongModel.countDocuments({ ownerId });
        const repertoires = await RepertoireModel.countDocuments({ ownerId });
        return { songs, repertoires };
      }),
  };
}
