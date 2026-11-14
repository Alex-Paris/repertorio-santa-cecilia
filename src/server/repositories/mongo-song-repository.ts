import "server-only";

import { LibraryError, SongInUseError } from "@/features/library/domain/library-errors";
import type { SongRepository } from "@/features/songs/data/song-repository";
import type { SongInput } from "@/features/songs/domain/song";
import { songInputSchema } from "@/features/songs/domain/song-schema";
import { createId } from "@/lib/utils/create-id";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { SongModel, type SongDocument } from "@/server/database/models/song-model";

import { toDomainSong } from "./document-mappers";
import { runLibraryWrite } from "./library-state";
import {
  assertRevision,
  isValidEntityId,
  revisionFilter,
  runPersistence,
  runTransaction,
  type OwnerContext,
} from "./persistence";

function validateInput(input: SongInput): SongInput {
  const result = songInputSchema.safeParse(input);
  if (!result.success) {
    throw new LibraryError("invalid-data");
  }
  return result.data;
}

/** Campos a gravar e, na edição, os do outro tipo de conteúdo a remover. */
function toWriteFields(input: SongInput): {
  set: Omit<SongDocument, "id" | "ownerId" | "referenceVersion" | "revision" | "createdAt" | "updatedAt">;
  unset: Partial<Record<"chordPro" | "sourceUrl", 1>>;
} {
  const { title, artist, originalKey, contentType } = input;
  const common = { title, artist, originalKey, contentType };

  if (input.contentType === "external-link") {
    return { set: { ...common, sourceUrl: input.sourceUrl }, unset: { chordPro: 1 } };
  }
  if (input.chordPro === undefined) {
    return { set: common, unset: { chordPro: 1, sourceUrl: 1 } };
  }
  return { set: { ...common, chordPro: input.chordPro }, unset: { sourceUrl: 1 } };
}

/** Implementa o contrato de músicas, sempre restrito a um usuário. */
export function createMongoSongRepository({ ownerId }: OwnerContext): SongRepository {
  /** Só escolhe a mensagem: a escrita já foi recusada pela operação atômica. */
  async function missingOrConflict(id: string): Promise<LibraryError> {
    return (await SongModel.exists({ ownerId, id }))
      ? new LibraryError("revision-conflict")
      : new LibraryError("song-not-found");
  }

  return {
    list: () =>
      runPersistence(async () => {
        const documents = await SongModel.find({ ownerId }).sort({ title: 1 }).lean();
        return documents.map(toDomainSong);
      }),

    findById: async (id) => {
      if (!isValidEntityId(id)) {
        return null;
      }
      return runPersistence(async () => {
        const document = await SongModel.findOne({ ownerId, id }).lean();
        return document ? toDomainSong(document) : null;
      });
    },

    findByIds: async (ids) => {
      const validIds = ids.filter(isValidEntityId);
      return runPersistence(async () => {
        const documents = await SongModel.find({ ownerId, id: { $in: validIds } }).lean();
        const byId = new Map(documents.map((document) => [document.id, toDomainSong(document)]));
        return validIds.flatMap((id) => byId.get(id) ?? []);
      });
    },

    create: async (input) => {
      const { set } = toWriteFields(validateInput(input));
      const now = new Date();
      const id = createId();

      return runLibraryWrite(ownerId, async (session) => {
        const [created] = await SongModel.create(
          [{ ...set, id, ownerId, referenceVersion: 0, revision: 1, createdAt: now, updatedAt: now }],
          { session },
        );
        return toDomainSong(created.toObject());
      });
    },

    update: async (id, input, expectedRevision) => {
      const { set, unset } = toWriteFields(validateInput(input));
      assertRevision(expectedRevision);
      if (!isValidEntityId(id)) {
        throw new LibraryError("song-not-found");
      }

      return runPersistence(async () => {
        // A revisão está no filtro: comparação e gravação são uma única operação atômica.
        const updated = await SongModel.findOneAndUpdate(
          { ownerId, id, ...revisionFilter(expectedRevision) },
          {
            $set: { ...set, revision: expectedRevision + 1, updatedAt: new Date() },
            $unset: unset,
          },
          { returnDocument: "after" },
        ).lean();

        if (!updated) {
          throw await missingOrConflict(id);
        }
        return toDomainSong(updated);
      });
    },

    delete: async (id, expectedRevision) => {
      assertRevision(expectedRevision);
      if (!isValidEntityId(id)) {
        throw new LibraryError("song-not-found");
      }

      await runTransaction(async (session) => {
        // Só itens particulares apontam para esta música; um ID igual no catálogo é outra música.
        const usedBy = await RepertoireModel.find(
          { ownerId, items: { $elemMatch: { songId: id, source: { $ne: "catalog" } } } },
          { id: 1, name: 1 },
        )
          .session(session)
          .lean();

        if (usedBy.length > 0) {
          throw new SongInUseError(usedBy.map((repertoire) => ({
            id: repertoire.id,
            name: repertoire.name,
          })));
        }

        // Se um repertório acabou de referenciar a música, esta escrita conflita e a
        // transação recomeça, encontrando a referência na nova tentativa.
        const { deletedCount } = await SongModel.deleteOne(
          { ownerId, id, ...revisionFilter(expectedRevision) },
          { session },
        );
        if (deletedCount === 0) {
          throw await missingOrConflict(id);
        }
      });
    },
  };
}
