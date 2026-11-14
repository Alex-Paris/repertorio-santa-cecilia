import type { Library } from "@/features/library/domain/library";
import { LibraryError } from "@/features/library/domain/library-errors";
import { createId } from "@/lib/utils/create-id";

import type {
  Repertoire,
  RepertoireId,
  RepertoireInput,
  RepertoireItemChanges,
} from "@/features/repertoires/domain/repertoire";
import {
  repertoireInputSchema,
  repertoireItemChangesSchema,
} from "@/features/repertoires/domain/repertoire-schema";
import {
  appendRepertoireItem,
  hasSongInRepertoire,
  applyRepertoireItemChanges,
  moveRepertoireItem,
  removeRepertoireItem,
  requireRepertoireItem,
} from "@/features/repertoires/services/repertoire-items";
import type { RepertoireRepository } from "@/features/repertoires/data/repertoire-repository";

import type { LibraryStore } from "./memory-library-store";
import { checkRevision } from "./revision";

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

/** Mesmas regras do contrato, em memória. Serve à API falsa dos testes de interface. */
export function createFakeRepertoireRepository(
  store: LibraryStore,
  /** Músicas publicadas do catálogo falso, quando houver. */
  isPublishedInCatalog: (songId: string) => boolean = () => false,
): RepertoireRepository {
  function changeRepertoire(
    id: RepertoireId,
    expectedRevision: number,
    change: (
      repertoire: Repertoire,
      library: Library,
    ) => Partial<Omit<Repertoire, "mass">> & { mass?: Repertoire["mass"] | null },
  ): Repertoire {
    return store.commit((library) => {
      const existing = library.repertoires.find((repertoire) => repertoire.id === id);
      if (!existing) {
        throw new LibraryError("repertoire-not-found");
      }
      checkRevision(existing.revision, expectedRevision);

      const { mass, ...changes } = change(existing, library);
      const updated: Repertoire = {
        ...existing,
        ...changes,
        revision: existing.revision + 1,
        updatedAt: new Date().toISOString(),
      };
      // Mesmo contrato do servidor: ausente mantém, `null` desvincula da missa.
      if (mass === null) {
        delete updated.mass;
      } else if (mass) {
        updated.mass = mass;
      }

      return {
        library: {
          ...library,
          repertoires: library.repertoires.map((repertoire) =>
            repertoire.id === id ? updated : repertoire,
          ),
        },
        result: updated,
      };
    });
  }

  return {
    list: async () => structuredClone(store.read().repertoires),

    findById: async (id) => {
      const repertoire = store.read().repertoires.find((candidate) => candidate.id === id);
      return repertoire ? structuredClone(repertoire) : null;
    },

    create: async (input) => {
      const { mass, ...data } = validateInput(input);

      return store.commit((library) => {
        const now = new Date().toISOString();
        const repertoire: Repertoire = {
          ...data,
          ...(mass ? { mass } : {}),
          id: createId(),
          items: [],
          revision: 1,
          createdAt: now,
          updatedAt: now,
        };
        return {
          library: { ...library, repertoires: [...library.repertoires, repertoire] },
          result: repertoire,
        };
      });
    },

    update: async (id, input, expectedRevision) => {
      const data = validateInput(input);
      return changeRepertoire(id, expectedRevision, () => data);
    },

    delete: async (id, expectedRevision) => {
      store.commit((library) => {
        const existing = library.repertoires.find((repertoire) => repertoire.id === id);
        if (!existing) {
          throw new LibraryError("repertoire-not-found");
        }
        checkRevision(existing.revision, expectedRevision);
        return {
          library: {
            ...library,
            repertoires: library.repertoires.filter((repertoire) => repertoire.id !== id),
          },
          result: undefined,
        };
      });
    },

    addSong: async (id, songId, expectedRevision, source = "personal", moment) =>
      changeRepertoire(id, expectedRevision, (repertoire, library) => {
        if (source === "catalog" ? !isPublishedInCatalog(songId) : !library.songs.some((song) => song.id === songId)) {
          throw new LibraryError(source === "catalog" ? "catalog-song-unavailable" : "song-not-found");
        }
        if (hasSongInRepertoire(repertoire.items, source, songId)) {
          throw new LibraryError("song-already-in-repertoire");
        }
        return { items: appendRepertoireItem(repertoire.items, songId, createId(), source, moment) };
      }),

    removeItem: async (id, itemId, expectedRevision) =>
      changeRepertoire(id, expectedRevision, (repertoire) => {
        requireRepertoireItem(repertoire.items, itemId);
        return { items: removeRepertoireItem(repertoire.items, itemId) };
      }),

    updateItem: async (id, itemId, changes, expectedRevision) => {
      const data = validateItemChanges(changes);

      return changeRepertoire(id, expectedRevision, (repertoire, library) => {
        const item = requireRepertoireItem(repertoire.items, itemId);

        const song = library.songs.find((candidate) => candidate.id === item.songId);
        if (data.transposeSemitones && song?.contentType === "external-link") {
          throw new LibraryError(
            "invalid-data",
            "Músicas com link externo não têm cifra para transpor.",
          );
        }

        return {
          items: repertoire.items.map((candidate) =>
            candidate.id === itemId ? applyRepertoireItemChanges(candidate, data) : candidate,
          ),
        };
      });
    },

    moveItem: async (id, itemId, direction, expectedRevision) =>
      changeRepertoire(id, expectedRevision, (repertoire) => {
        requireRepertoireItem(repertoire.items, itemId);
        return { items: moveRepertoireItem(repertoire.items, itemId, direction) };
      }),
  };
}
