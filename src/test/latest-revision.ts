import type { RepertoireRepository } from "@/features/repertoires/data/repertoire-repository";
import type { SongRepository } from "@/features/songs/data/song-repository";

interface Repositories {
  songs: SongRepository;
  repertoires: RepertoireRepository;
}

type UnversionedSongs = Omit<SongRepository, "update" | "delete"> & {
  update(id: string, input: Parameters<SongRepository["update"]>[1]): ReturnType<SongRepository["update"]>;
  delete(id: string): Promise<void>;
};

type R = RepertoireRepository;

type UnversionedRepertoires = Omit<R, "update" | "delete" | "addSong" | "removeItem" | "moveItem" | "updateItem"> & {
  update(id: string, input: Parameters<R["update"]>[1]): ReturnType<R["update"]>;
  delete(id: string): Promise<void>;
  addSong(
    id: string,
    songId: string,
    source?: Parameters<R["addSong"]>[3],
    moment?: Parameters<R["addSong"]>[4],
  ): ReturnType<R["addSong"]>;
  removeItem(id: string, itemId: string): ReturnType<R["removeItem"]>;
  moveItem(id: string, itemId: string, direction: Parameters<R["moveItem"]>[2]): ReturnType<R["moveItem"]>;
  updateItem(id: string, itemId: string, changes: Parameters<R["updateItem"]>[2]): ReturnType<R["updateItem"]>;
};

export interface LatestRevisionRepositories {
  songs: UnversionedSongs;
  repertoires: UnversionedRepertoires;
}

const cache = new WeakMap<Repositories, LatestRevisionRepositories>();

export function latestSongs(songs: SongRepository): UnversionedSongs {
  const revision = async (id: string) => (await songs.findById(id))?.revision ?? 1;
  return {
    list: () => songs.list(),
    findById: (id) => songs.findById(id),
    findByIds: (ids) => songs.findByIds(ids),
    create: (input) => songs.create(input),
    update: async (id, input) => songs.update(id, input, await revision(id)),
    delete: async (id) => songs.delete(id, await revision(id)),
  };
}

export function latestRepertoires(repertoires: RepertoireRepository): UnversionedRepertoires {
  const revision = async (id: string) => (await repertoires.findById(id))?.revision ?? 1;
  return {
    list: () => repertoires.list(),
    findById: (id) => repertoires.findById(id),
    create: (input) => repertoires.create(input),
    update: async (id, input) => repertoires.update(id, input, await revision(id)),
    delete: async (id) => repertoires.delete(id, await revision(id)),
    addSong: async (id, songId, source, moment) =>
      repertoires.addSong(id, songId, await revision(id), source, moment),
    removeItem: async (id, itemId) => repertoires.removeItem(id, itemId, await revision(id)),
    moveItem: async (id, itemId, direction) =>
      repertoires.moveItem(id, itemId, direction, await revision(id)),
    updateItem: async (id, itemId, changes) =>
      repertoires.updateItem(id, itemId, changes, await revision(id)),
  };
}

/** Um repositório só, de músicas ou de repertórios. */
export function latestOf(repository: SongRepository): UnversionedSongs;
export function latestOf(repository: RepertoireRepository): UnversionedRepertoires;
export function latestOf(
  repository: SongRepository | RepertoireRepository,
): UnversionedSongs | UnversionedRepertoires {
  return "addSong" in repository ? latestRepertoires(repository) : latestSongs(repository);
}

/**
 * Para testes de outras regras (validação, ordem, isolamento): cada escrita usa a revisão
 * atual, lida antes. Os testes de concorrência usam os repositórios diretamente.
 */
export function latest(repositories: Repositories): LatestRevisionRepositories {
  const cached = cache.get(repositories);
  if (cached) {
    return cached;
  }

  const wrapped: LatestRevisionRepositories = {
    songs: latestSongs(repositories.songs),
    repertoires: latestRepertoires(repositories.repertoires),
  };

  cache.set(repositories, wrapped);
  return wrapped;
}
