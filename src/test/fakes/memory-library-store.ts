import type { Library, LibraryRecord } from "@/features/library/domain/library";

export interface LibraryChange<T> {
  library: Library;
  result: T;
}

export interface LibraryStore {
  read(): Library;
  commit<T>(change: (library: Library) => LibraryChange<T>): T;
}

/** Registros sem revisão, como os de um backup, começam na primeira, como no servidor. */
export function withRevisions(library: LibraryRecord): Library {
  return {
    songs: library.songs.map((song) => ({ revision: 1, ...song })),
    repertoires: library.repertoires.map((repertoire) => ({ revision: 1, ...repertoire })),
    catalogSongs: [],
  };
}

/** Biblioteca em memória, somente para a API falsa dos testes. */
export function createMemoryLibraryStore(
  initial: LibraryRecord = { songs: [], repertoires: [] },
): LibraryStore {
  let library = structuredClone(withRevisions(initial));

  return {
    read: () => library,
    commit(change) {
      const { library: next, result } = change(library);
      library = next;
      return result;
    },
  };
}
