import type { SongReader } from "@/features/songs/data/song-repository";
import { findLibrarySong, type CatalogSongView } from "@/features/library/domain/library";
import { transposableKey, type MusicalSong, type Song } from "@/features/songs/domain/song";
import { transposeKey } from "@/features/songs/domain/transposition";

import type { RepertoireReader } from "../data/repertoire-repository";
import type { Repertoire, RepertoireId, RepertoireItem } from "../domain/repertoire";

export interface RepertoireEntry {
  item: RepertoireItem;
  /** `null` quando a música não existe mais ou saiu do catálogo. A referência é mantida. */
  song: MusicalSong | null;
  /** Tom derivado do deslocamento do item; `null` quando é o próprio tom original. */
  preferredKey: string | null;
}

export interface RepertoireDetail {
  repertoire: Repertoire;
  entries: RepertoireEntry[];
}

export function sortRepertoireItems(items: readonly RepertoireItem[]): RepertoireItem[] {
  return [...items].sort((a, b) => a.position - b.position);
}

/** Combina os itens, já ordenados por `position`, com as músicas correspondentes. */
export function buildRepertoireEntries(
  items: readonly RepertoireItem[],
  songs: readonly Song[],
  catalogSongs: readonly CatalogSongView[] = [],
): RepertoireEntry[] {
  const library = { songs: [...songs], catalogSongs: [...catalogSongs] };

  return sortRepertoireItems(items).map((item) => {
    const song = findLibrarySong(library, item.source, item.songId) ?? null;
    const key = song ? transposableKey(song) : null;
    const preferredKey = key && item.transposeSemitones !== 0 ? transposeKey(key, item.transposeSemitones) : null;

    return { item, song, preferredKey };
  });
}

export async function getRepertoireDetail(
  id: RepertoireId,
  repositories: { repertoires: RepertoireReader; songs: SongReader },
): Promise<RepertoireDetail | null> {
  const repertoire = await repositories.repertoires.findById(id);
  if (!repertoire) {
    return null;
  }

  const songs = await repositories.songs.findByIds(
    repertoire.items.map((item) => item.songId),
  );

  return { repertoire, entries: buildRepertoireEntries(repertoire.items, songs) };
}
