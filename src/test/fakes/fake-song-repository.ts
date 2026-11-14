import { LibraryError, SongInUseError } from "@/features/library/domain/library-errors";
import { findRepertoiresUsingSong } from "@/features/repertoires/services/repertoire-items";
import { createId } from "@/lib/utils/create-id";

import type { SongRepository } from "@/features/songs/data/song-repository";
import type { Song, SongInput } from "@/features/songs/domain/song";
import { songInputSchema } from "@/features/songs/domain/song-schema";

import type { LibraryStore } from "./memory-library-store";
import { checkRevision } from "./revision";

function validateInput(input: SongInput): SongInput {
  const result = songInputSchema.safeParse(input);
  if (!result.success) {
    throw new LibraryError("invalid-data");
  }
  return result.data;
}

/** Mesmas regras do contrato, em memória. Serve à API falsa dos testes de interface. */
export function createFakeSongRepository(store: LibraryStore): SongRepository {
  return {
    list: async () => structuredClone(store.read().songs),

    findById: async (id) => {
      const song = store.read().songs.find((candidate) => candidate.id === id);
      return song ? structuredClone(song) : null;
    },

    findByIds: async (ids) => {
      const songs = store.read().songs;
      return structuredClone(
        ids.flatMap((id) => songs.filter((song) => song.id === id)),
      );
    },

    create: async (input) => {
      const data = validateInput(input);

      return store.commit((library) => {
        const now = new Date().toISOString();
        const song: Song = { ...data, id: createId(), revision: 1, createdAt: now, updatedAt: now };
        return { library: { ...library, songs: [...library.songs, song] }, result: song };
      });
    },

    update: async (id, input, expectedRevision) => {
      const data = validateInput(input);

      return store.commit((library) => {
        const existing = library.songs.find((song) => song.id === id);
        if (!existing) {
          throw new LibraryError("song-not-found");
        }
        checkRevision(existing.revision, expectedRevision);

        // Parte apenas dos dados informados: trocar o tipo não deixa campos do tipo anterior.
        const song: Song = {
          ...data,
          id,
          revision: existing.revision + 1,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        };

        return {
          library: {
            ...library,
            songs: library.songs.map((candidate) => (candidate.id === id ? song : candidate)),
          },
          result: song,
        };
      });
    },

    delete: async (id, expectedRevision) => {
      store.commit((library) => {
        const existing = library.songs.find((song) => song.id === id);
        if (!existing) {
          throw new LibraryError("song-not-found");
        }

        const usedBy = findRepertoiresUsingSong(library.repertoires, id);
        if (usedBy.length > 0) {
          throw new SongInUseError(usedBy.map(({ id: repertoireId, name }) => ({ id: repertoireId, name })));
        }
        checkRevision(existing.revision, expectedRevision);

        return {
          library: { ...library, songs: library.songs.filter((song) => song.id !== id) },
          result: undefined,
        };
      });
    },
  };
}
