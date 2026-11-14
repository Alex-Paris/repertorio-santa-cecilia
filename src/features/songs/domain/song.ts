import type { MusicalKey } from "./musical-key";

export type SongId = string;

/** Data e hora em ISO 8601; serializável entre servidor, cliente e persistência. */
export type IsoDateTime = string;

/** Tipos de conteúdo de uma música particular. */
export const CONTENT_TYPES = ["original", "authorized", "external-link"] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

/**
 * O catálogo tem também músicas só com metadados: conhecidas, mas sem cifra nem link
 * autorizados. Músicas particulares não usam este tipo.
 */
export const CATALOG_CONTENT_TYPES = [...CONTENT_TYPES, "metadata-only"] as const;

export type CatalogContentType = (typeof CATALOG_CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<CatalogContentType, string> = {
  original: "Própria",
  authorized: "Autorizada",
  "external-link": "Link externo",
  "metadata-only": "Somente metadados",
};

interface SongBase {
  id: SongId;
  title: string;
  artist: string;
  originalKey: MusicalKey;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Música cuja cifra pode ser armazenada na plataforma. */
export interface HostedSongRecord extends SongBase {
  contentType: "original" | "authorized";
  chordPro?: string;
  sourceUrl?: never;
}

/** Música que apenas aponta para a fonte original; a cifra nunca é copiada. */
export interface ExternalLinkSongRecord extends SongBase {
  contentType: "external-link";
  sourceUrl: string;
  chordPro?: never;
}

/** Formato do backup e da biblioteca antiga do navegador: sem controle de versão. */
export type SongRecord = HostedSongRecord | ExternalLinkSongRecord;

/**
 * Música do catálogo conhecida só pelos metadados: sem cifra e sem link. O tom pode ser
 * desconhecido, porque muitas fontes (hinários, subsídios) não o informam.
 */
export interface MetadataOnlySongInput {
  title: string;
  artist: string;
  originalKey?: MusicalKey;
  contentType: "metadata-only";
  chordPro?: never;
  sourceUrl?: never;
}

/** Dados musicais de qualquer música, do catálogo ou particular: o que o leitor precisa. */
export type MusicalSong = (SongInput | MetadataOnlySongInput) & { id: SongId };

/** Dados musicais aceitos no catálogo: os de uma música particular e os só de metadados. */
export type CatalogSongInputData = SongInput | MetadataOnlySongInput;

/**
 * Tom a partir do qual um repertório pode transpor. Link externo nunca transpõe; música só
 * com metadados transpõe apenas se o tom original for conhecido.
 */
export function transposableKey(song: Pick<MusicalSong, "contentType" | "originalKey">): MusicalKey | null {
  return song.contentType === "external-link" ? null : (song.originalKey ?? null);
}

/** De onde vem a música de um item de repertório. Itens antigos, sem o campo, são `personal`. */
export const SONG_SOURCES = ["catalog", "personal"] as const;

export type SongSource = (typeof SONG_SOURCES)[number];

/** Número da versão de um documento. Começa em 1 e só o servidor o altera. */
export type Revision = number;

/** Música como a conta a entrega: o registro mais a revisão atual. */
export type Song = SongRecord & { revision: Revision };

type SongManagedField = "id" | "createdAt" | "updatedAt";

/** Dados informados pelo usuário; identificador e datas são definidos ao salvar. */
export type SongInput =
  | Omit<HostedSongRecord, SongManagedField>
  | Omit<ExternalLinkSongRecord, SongManagedField>;

export function formatSongCount(count: number): string {
  return count === 1 ? "1 música" : `${count} músicas`;
}
