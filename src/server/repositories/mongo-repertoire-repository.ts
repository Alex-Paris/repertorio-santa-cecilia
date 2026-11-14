import "server-only";

import type { ClientSession } from "mongoose";

import { LibraryError } from "@/features/library/domain/library-errors";
import type { RepertoireRepository } from "@/features/repertoires/data/repertoire-repository";
import type {
  Repertoire,
  RepertoireId,
  RepertoireInput,
  RepertoireItem,
  RepertoireItemChanges,
} from "@/features/repertoires/domain/repertoire";
import {
  repertoireInputSchema,
  repertoireItemChangesSchema,
} from "@/features/repertoires/domain/repertoire-schema";
import { LITURGICAL_MOMENT_IDS } from "@/features/liturgy/domain/vocabulary";
import { CatalogSongModel } from "@/server/database/models/catalog-song-model";
import {
  appendRepertoireItem,
  hasSongInRepertoire,
  applyRepertoireItemChanges,
  moveRepertoireItem,
  removeRepertoireItem,
  requireRepertoireItem,
} from "@/features/repertoires/services/repertoire-items";
import { createId } from "@/lib/utils/create-id";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { SongModel } from "@/server/database/models/song-model";
import { revokeRepertoireShares } from "@/server/sharing/share-revocation";

import { toDomainRepertoire } from "./document-mappers";
import { runLibraryWrite } from "./library-state";
import {
  assertRevision,
  isValidEntityId,
  revisionFilter,
  runPersistence,
  runTransaction,
  type OwnerContext,
} from "./persistence";

function validateInput(input: RepertoireInput): RepertoireInput {
  const result = repertoireInputSchema.safeParse(input);
  if (!result.success) {
    throw new LibraryError("invalid-data");
  }
  return result.data;
}

function validateItemChanges(changes: RepertoireItemChanges): RepertoireItemChanges {
  const result = repertoireItemChangesSchema.safeParse(changes);
  if (!result.success) {
    throw new LibraryError("invalid-data", result.error.issues[0].message);
  }
  return result.data;
}

/** Implementa o contrato de repertórios, sempre restrito a um usuário. */
export function createMongoRepertoireRepository({ ownerId }: OwnerContext): RepertoireRepository {
  /** Só escolhe a mensagem: a escrita já foi recusada pela operação atômica. */
  async function missingOrConflict(id: string): Promise<LibraryError> {
    return (await RepertoireModel.exists({ ownerId, id }))
      ? new LibraryError("revision-conflict")
      : new LibraryError("repertoire-not-found");
  }

  /**
   * Lê e regrava os itens na mesma transação. A revisão esperada é conferida na leitura,
   * para não calcular sobre dados antigos, e de novo no filtro da própria gravação.
   */
  function changeItems(
    id: RepertoireId,
    expectedRevision: number,
    change: (repertoire: Repertoire, session: ClientSession) => Promise<RepertoireItem[]> | RepertoireItem[],
  ): Promise<Repertoire> {
    assertRevision(expectedRevision);
    if (!isValidEntityId(id)) {
      throw new LibraryError("repertoire-not-found");
    }

    return runTransaction(async (session) => {
      const document = await RepertoireModel.findOne({ ownerId, id }).session(session).lean();
      if (!document) {
        throw new LibraryError("repertoire-not-found");
      }

      const repertoire = toDomainRepertoire(document);
      if (repertoire.revision !== expectedRevision) {
        throw new LibraryError("revision-conflict");
      }

      const items = await change(repertoire, session);
      const updatedAt = new Date();
      const revision = expectedRevision + 1;

      const { matchedCount } = await RepertoireModel.updateOne(
        { ownerId, id, ...revisionFilter(expectedRevision) },
        { $set: { items, updatedAt, revision } },
        { session },
      );
      if (matchedCount === 0) {
        throw new LibraryError("revision-conflict");
      }
      return { ...repertoire, items, revision, updatedAt: updatedAt.toISOString() };
    });
  }

  return {
    list: () =>
      runPersistence(async () => {
        const documents = await RepertoireModel.find({ ownerId }).sort({ updatedAt: -1 }).lean();
        return documents.map(toDomainRepertoire);
      }),

    findById: async (id) => {
      if (!isValidEntityId(id)) {
        return null;
      }
      return runPersistence(async () => {
        const document = await RepertoireModel.findOne({ ownerId, id }).lean();
        return document ? toDomainRepertoire(document) : null;
      });
    },

    create: async (input) => {
      const { mass, ...data } = validateInput(input);
      const now = new Date();
      const id = createId();

      return runLibraryWrite(ownerId, async (session) => {
        const [created] = await RepertoireModel.create(
          [{ ...data, ...(mass ? { mass } : {}), id, ownerId, items: [], revision: 1, createdAt: now, updatedAt: now }],
          { session },
        );
        return toDomainRepertoire(created.toObject());
      });
    },

    update: async (id, input, expectedRevision) => {
      const { mass, ...data } = validateInput(input);
      assertRevision(expectedRevision);
      if (!isValidEntityId(id)) {
        throw new LibraryError("repertoire-not-found");
      }

      return runPersistence(async () => {
        const updated = await RepertoireModel.findOneAndUpdate(
          { ownerId, id, ...revisionFilter(expectedRevision) },
          {
            // Sem `mass` no pedido, o vínculo com a missa fica como está; `null` o remove.
            $set: { ...data, ...(mass ? { mass } : {}), revision: expectedRevision + 1, updatedAt: new Date() },
            ...(mass === null ? { $unset: { mass: 1 } } : {}),
          },
          { returnDocument: "after" },
        ).lean();

        if (!updated) {
          throw await missingOrConflict(id);
        }
        return toDomainRepertoire(updated);
      });
    },

    delete: async (id, expectedRevision) => {
      assertRevision(expectedRevision);
      if (!isValidEntityId(id)) {
        throw new LibraryError("repertoire-not-found");
      }

      // Na mesma transação: nenhuma publicação ativa sobrevive ao repertório.
      await runTransaction(async (session) => {
        const { deletedCount } = await RepertoireModel.deleteOne(
          { ownerId, id, ...revisionFilter(expectedRevision) },
          { session },
        );
        if (deletedCount === 0) {
          throw await missingOrConflict(id);
        }
        await revokeRepertoireShares(ownerId, id, session);
      });
    },

    addSong: async (id, songId, expectedRevision, source = "personal", moment) => {
      if (moment !== undefined && !LITURGICAL_MOMENT_IDS.includes(moment)) {
        throw new LibraryError("invalid-data", "Escolha um momento da missa válido.");
      }
      if (!isValidEntityId(songId)) {
        throw new LibraryError(source === "catalog" ? "catalog-song-not-found" : "song-not-found");
      }
      if (source !== "personal" && source !== "catalog") {
        throw new LibraryError("invalid-data");
      }

      return changeItems(id, expectedRevision, async (repertoire, session) => {
        if (hasSongInRepertoire(repertoire.items, source, songId)) {
          throw new LibraryError("song-already-in-repertoire");
        }

        if (source === "catalog") {
          // Só músicas publicadas entram em repertórios. A música global não é alterada.
          const published = await CatalogSongModel.exists({ id: songId, status: "published" }).session(session);
          if (!published) {
            throw new LibraryError("catalog-song-unavailable");
          }
        } else {
          // Grava na música para conflitar com uma exclusão simultânea. Só ler não bastaria:
          // cada transação veria um estado válido, e ambas poderiam ser confirmadas.
          const { matchedCount } = await SongModel.updateOne(
            { ownerId, id: songId },
            { $inc: { referenceVersion: 1 } },
            { session },
          );
          if (matchedCount === 0) {
            throw new LibraryError("song-not-found");
          }
        }

        return appendRepertoireItem(repertoire.items, songId, createId(), source, moment);
      });
    },

    removeItem: async (id, itemId, expectedRevision) =>
      changeItems(id, expectedRevision, (repertoire) => {
        requireRepertoireItem(repertoire.items, itemId);
        return removeRepertoireItem(repertoire.items, itemId);
      }),

    moveItem: async (id, itemId, direction, expectedRevision) =>
      changeItems(id, expectedRevision, (repertoire) => {
        requireRepertoireItem(repertoire.items, itemId);
        return moveRepertoireItem(repertoire.items, itemId, direction);
      }),

    updateItem: async (id, itemId, changes, expectedRevision) => {
      const data = validateItemChanges(changes);

      return changeItems(id, expectedRevision, async (repertoire, session) => {
        const item = requireRepertoireItem(repertoire.items, itemId);

        if (data.transposeSemitones) {
          // A origem do item decide onde procurar: nunca a música de outra origem ou conta.
          const song =
            item.source === "catalog"
              ? await CatalogSongModel.findOne({ id: item.songId }, { contentType: 1, originalKey: 1 }).session(session).lean()
              : await SongModel.findOne({ ownerId, id: item.songId }, { contentType: 1, originalKey: 1 }).session(session).lean();
          if (song?.contentType === "external-link") {
            throw new LibraryError(
              "invalid-data",
              "Músicas com link externo não têm cifra para transpor.",
            );
          }
          // Sem tom original conhecido (música só com metadados), não há tom de destino.
          if (song && !song.originalKey) {
            throw new LibraryError("invalid-data", "O tom original desta música não foi informado: não há como transpor.");
          }
        }

        return repertoire.items.map((candidate) =>
          candidate.id === itemId ? applyRepertoireItemChanges(candidate, data) : candidate,
        );
      });
    },
  };
}
