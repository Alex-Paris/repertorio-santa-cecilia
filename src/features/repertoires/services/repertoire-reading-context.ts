import type { SongId, SongSource } from "@/features/songs/domain/song";

import type { Repertoire, RepertoireId, RepertoireItem, RepertoireItemId } from "../domain/repertoire";

/** IDs informados pela URL. Não são confiáveis até serem conferidos com os dados salvos. */
export interface RepertoireContextReference {
  repertoireId: RepertoireId;
  itemId: RepertoireItemId;
}

export interface RepertoireReadingContext {
  repertoire: Repertoire;
  item: RepertoireItem;
}

type QueryValue = string | string[] | undefined;

/** Parâmetros da URL no formato recebido pelas páginas. */
export interface RepertoireContextQuery {
  repertoireId?: QueryValue;
  itemId?: QueryValue;
}

export function parseRepertoireContextQuery({
  repertoireId,
  itemId,
}: RepertoireContextQuery): RepertoireContextReference | undefined {
  return typeof repertoireId === "string" && typeof itemId === "string"
    ? { repertoireId, itemId }
    : undefined;
}

function buildContextQuery(repertoireId: RepertoireId, itemId: RepertoireItemId): string {
  return new URLSearchParams({ repertoireId, itemId }).toString();
}

/** A origem do item decide o leitor: catálogo ou biblioteca particular. */
export function getRepertoireSongHref(
  repertoireId: RepertoireId,
  item: Pick<RepertoireItem, "id" | "songId"> & { source?: SongSource },
): string {
  const base = item.source === "catalog" ? "/catalogo" : "/musicas";
  return `${base}/${encodeURIComponent(item.songId)}?${buildContextQuery(repertoireId, item.id)}`;
}

/** Link de edição que devolve o usuário à leitura de onde veio. */
export function getSongEditHref(songId: SongId, context: RepertoireReadingContext | null): string {
  const path = `/musicas/${encodeURIComponent(songId)}/editar`;
  return context ? `${path}?${buildContextQuery(context.repertoire.id, context.item.id)}` : path;
}

/** Destino ao terminar uma edição: a leitura contextual, se o contexto for válido. */
export function getSongReadingHref(songId: SongId, context: RepertoireReadingContext | null): string {
  return context
    ? getRepertoireSongHref(context.repertoire.id, context.item)
    : `/musicas/${encodeURIComponent(songId)}`;
}

/** Só reconhece o contexto se o item existir no repertório e pertencer a esta música. */
export function resolveRepertoireReadingContext(
  repertoires: readonly Repertoire[],
  songId: SongId,
  reference: RepertoireContextReference,
  source: SongSource = "personal",
): RepertoireReadingContext | null {
  const repertoire = repertoires.find((candidate) => candidate.id === reference.repertoireId);
  const item = repertoire?.items.find((candidate) => candidate.id === reference.itemId);

  return repertoire && item && item.songId === songId && item.source === source
    ? { repertoire, item }
    : null;
}
