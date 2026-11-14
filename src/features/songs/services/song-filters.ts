import { normalizeText } from "@/lib/utils/normalize-text";

import type { ContentType, Song } from "../domain/song";

export type ContentTypeFilter = ContentType | "all";

export interface SongFilters {
  query: string;
  contentType: ContentTypeFilter;
}

function matchesQuery(song: Song, normalizedQuery: string): boolean {
  return (
    normalizeText(song.title).includes(normalizedQuery) ||
    normalizeText(song.artist).includes(normalizedQuery)
  );
}

/** Filtra por título ou artista (sem diferenciar acentos ou caixa) e por tipo de conteúdo. */
export function filterSongs(songs: readonly Song[], filters: SongFilters): Song[] {
  const normalizedQuery = normalizeText(filters.query);

  return songs.filter(
    (song) =>
      (filters.contentType === "all" || song.contentType === filters.contentType) &&
      matchesQuery(song, normalizedQuery),
  );
}

export function sortSongsByTitle(songs: readonly Song[]): Song[] {
  return [...songs].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}
