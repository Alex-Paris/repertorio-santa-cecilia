import { z } from "zod";

import {
  catalogSearchResultSchema,
  catalogSongViewSchema,
  type CatalogSearchResult,
  type CatalogSongView,
} from "../domain/catalog-song";

const songResponse = z.object({ song: catalogSongViewSchema });

/** Leitura pública do catálogo, sem sessão. Respostas são validadas antes do uso. */
export async function searchCatalogSongs(
  params: { q: string; page?: number; pageSize?: number },
  signal?: AbortSignal,
): Promise<CatalogSearchResult> {
  const query = new URLSearchParams({ q: params.q, page: String(params.page ?? 1) });
  if (params.pageSize) {
    query.set("pageSize", String(params.pageSize));
  }
  const response = await fetch(`/api/v1/catalog/songs?${query}`, { cache: "no-store", signal });
  if (!response.ok) {
    throw new Error("catalogo-indisponivel");
  }
  return catalogSearchResultSchema.parse(await response.json());
}

export async function fetchCatalogSong(id: string, signal?: AbortSignal): Promise<CatalogSongView | null> {
  const response = await fetch(`/api/v1/catalog/songs/${encodeURIComponent(id)}`, { cache: "no-store", signal });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("catalogo-indisponivel");
  }
  return songResponse.parse(await response.json()).song;
}
