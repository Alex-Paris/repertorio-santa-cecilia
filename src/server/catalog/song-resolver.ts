import "server-only";

import type { ClientSession } from "mongoose";

import type { CatalogSong } from "@/features/catalog/domain/catalog-song";
import type { Song, SongId, SongSource } from "@/features/songs/domain/song";
import { CatalogSongModel } from "@/server/database/models/catalog-song-model";
import { SongModel } from "@/server/database/models/song-model";
import { toDomainSong } from "@/server/repositories/document-mappers";
import { isValidEntityId } from "@/server/repositories/persistence";

import { toCatalogSong } from "./catalog-mappers";

export interface SongReference {
  source: SongSource;
  songId: SongId;
}

export type ResolvedSong =
  | { source: "personal"; song: Song }
  /** Inclui o estado e os direitos: quem chama decide o que pode ser mostrado. */
  | { source: "catalog"; song: CatalogSong };

export function referenceKey({ source, songId }: SongReference): string {
  return `${source}:${songId}`;
}

/**
 * Resolve referências de repertório em lote: no máximo uma consulta por origem.
 * Músicas particulares só da conta informada; nunca há outra origem como alternativa.
 */
export async function resolveSongReferences(
  references: readonly SongReference[],
  { ownerId, session }: { ownerId: string; session?: ClientSession },
): Promise<Map<string, ResolvedSong>> {
  const ids = (source: SongSource) => [
    ...new Set(
      references
        .filter((reference) => reference.source === source && isValidEntityId(reference.songId))
        .map((reference) => reference.songId),
    ),
  ];

  const personalIds = ids("personal");
  const catalogIds = ids("catalog");

  const [personal, catalog] = await Promise.all([
    personalIds.length > 0
      ? SongModel.find({ ownerId, id: { $in: personalIds } }).session(session ?? null).lean()
      : [],
    catalogIds.length > 0
      ? CatalogSongModel.find({ id: { $in: catalogIds } }, { searchTokens: 0, sortTitle: 0 })
          .session(session ?? null)
          .lean()
      : [],
  ]);

  const resolved = new Map<string, ResolvedSong>();
  for (const document of personal) {
    resolved.set(referenceKey({ source: "personal", songId: document.id }), {
      source: "personal",
      song: toDomainSong(document),
    });
  }
  for (const document of catalog) {
    resolved.set(referenceKey({ source: "catalog", songId: document.id }), {
      source: "catalog",
      song: toCatalogSong(document),
    });
  }
  return resolved;
}
