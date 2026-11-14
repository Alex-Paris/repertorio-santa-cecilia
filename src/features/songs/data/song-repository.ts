import type { Revision, Song, SongId, SongInput } from "../domain/song";

/** Operações de leitura de músicas. */
export interface SongReader {
  list(): Promise<Song[]>;
  findById(id: SongId): Promise<Song | null>;
  findByIds(ids: readonly SongId[]): Promise<Song[]>;
}

/**
 * Contrato de acesso às músicas. É assíncrono para que a persistência local
 * possa ser trocada por uma API sem alterar quem consome. As operações de
 * escrita rejeitam com `LibraryError` quando os dados não forem salvos.
 */
export interface SongRepository extends SongReader {
  create(input: SongInput): Promise<Song>;
  /**
   * Só altera a revisão esperada; rejeita com `revision-conflict` se outra alteração veio
   * antes. O servidor define a nova revisão.
   */
  update(id: SongId, input: SongInput, expectedRevision: Revision): Promise<Song>;
  /** Rejeita com `SongInUseError` se a música fizer parte de algum repertório. */
  delete(id: SongId, expectedRevision: Revision): Promise<void>;
}

export function createInMemorySongRepository(seed: readonly Song[]): SongReader {
  const songsById = new Map(seed.map((song) => [song.id, song]));

  return {
    list: async () => [...songsById.values()],
    findById: async (id) => songsById.get(id) ?? null,
    findByIds: async (ids) =>
      ids.flatMap((id) => {
        const song = songsById.get(id);
        return song ? [song] : [];
      }),
  };
}
