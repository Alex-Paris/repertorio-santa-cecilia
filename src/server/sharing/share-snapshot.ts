import "server-only";

import { createHash } from "node:crypto";

import { LibraryError } from "@/features/library/domain/library-errors";
import type { RepertoireRecord } from "@/features/repertoires/domain/repertoire";
import { sortRepertoireItems } from "@/features/repertoires/services/repertoire-service";
import {
  publicShareSnapshotSchema,
  type PublicShareContent,
  type PublicShareItem,
  type PublicShareSnapshot,
} from "@/features/sharing/domain/public-share";
import { transposableKey, type MusicalSong, type SongId, type SongRecord, type SongSource } from "@/features/songs/domain/song";

export interface BuiltShare {
  snapshot: PublicShareSnapshot;
  contentHash: string;
  sources: { publicItemId: string; songId: SongId; source: SongSource }[];
}

/** Música do catálogo com o que a plataforma permite fazer com ela neste momento. */
export interface CatalogShareSong {
  song: MusicalSong;
  published: boolean;
  /** A plataforma tem direito de redistribuir a cifra em links públicos. */
  canShareChordPro: boolean;
}

interface BuildShareInput {
  shareId: string;
  repertoire: RepertoireRecord;
  /** Músicas particulares da conta. */
  songs: readonly SongRecord[];
  /** Músicas do catálogo usadas no repertório, por ID. */
  catalogSongs?: ReadonlyMap<SongId, CatalogShareSong>;
  /** Músicas particulares cuja cifra o proprietário confirmou individualmente. */
  authorizedSongIds: ReadonlySet<SongId>;
  /** O proprietário escolheu publicar a data da celebração. */
  includeMassDate?: boolean;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function hashChordPro(chordPro: string): string {
  return sha256(chordPro);
}

/** Estável entre atualizações, e sem revelar o ID do item na biblioteca privada. */
function derivePublicItemId(shareId: string, itemId: string): string {
  return sha256(`${shareId}:${itemId}`).slice(0, 32);
}

/** Identifica o conteúdo, sem depender dos IDs: a prévia ainda não conhece o ID definitivo. */
export function hashSnapshot({ name, description, mass, items }: PublicShareSnapshot): string {
  // Campos ausentes somem do JSON: publicações anteriores à Etapa 2E.2 mantêm o mesmo hash.
  return sha256(
    JSON.stringify({
      name,
      description,
      mass,
      items: items.map(({ title, artist, originalKey, transposeSemitones, content, moment }) => ({
        title,
        artist,
        originalKey,
        transposeSemitones,
        content,
        moment,
      })),
    }),
  );
}

function assertAuthorizationsApply(
  repertoire: RepertoireRecord,
  songsById: ReadonlyMap<SongId, SongRecord>,
  authorizedSongIds: ReadonlySet<SongId>,
): void {
  // A confirmação do proprietário vale só para músicas particulares; o catálogo segue a plataforma.
  const inRepertoire = new Set(
    repertoire.items.filter((item) => item.source === "personal").map((item) => item.songId),
  );

  for (const songId of authorizedSongIds) {
    const song = songsById.get(songId);

    if (!inRepertoire.has(songId) || !song) {
      throw new LibraryError("share-preview-outdated");
    }
    if (song.contentType === "external-link" || !song.chordPro?.trim()) {
      throw new LibraryError("invalid-data", `“${song.title}” não tem cifra para publicar.`);
    }
  }
}

/** O tipo e o conteúdo vêm sempre do documento salvo, nunca do que o navegador enviou. */
function toPublicContent(song: SongRecord, isAuthorized: boolean): PublicShareContent {
  if (song.contentType === "external-link") {
    return { kind: "external-link", sourceUrl: song.sourceUrl };
  }
  return isAuthorized && song.chordPro?.trim()
    ? { kind: "chordpro", chordPro: song.chordPro }
    : { kind: "none" };
}

/** Catálogo: a cifra só entra com permissão de redistribuição da plataforma. */
function toCatalogPublicContent(entry: CatalogShareSong): PublicShareContent {
  if (!entry.published) {
    return { kind: "unavailable" };
  }
  if (entry.song.contentType === "metadata-only") {
    return { kind: "none" };
  }
  if (entry.song.contentType === "external-link") {
    return { kind: "external-link", sourceUrl: entry.song.sourceUrl };
  }
  return entry.canShareChordPro && entry.song.chordPro?.trim()
    ? { kind: "chordpro", chordPro: entry.song.chordPro }
    : { kind: "none" };
}

/** Monta a publicação campo a campo: o que não está listado aqui não existe para o público. */
export function buildShareSnapshot({
  shareId,
  repertoire,
  songs,
  catalogSongs = new Map(),
  authorizedSongIds,
  includeMassDate = false,
}: BuildShareInput): BuiltShare {
  const songsById = new Map(songs.map((song) => [song.id, song]));
  assertAuthorizationsApply(repertoire, songsById, authorizedSongIds);

  if (repertoire.items.length === 0) {
    throw new LibraryError("invalid-data", "Adicione músicas ao repertório antes de publicar.");
  }

  const sources: BuiltShare["sources"] = [];
  const items = sortRepertoireItems(repertoire.items).map((item, index): PublicShareItem => {
    const catalogEntry = item.source === "catalog" ? catalogSongs.get(item.songId) : undefined;
    const song: MusicalSong | undefined =
      item.source === "catalog" ? catalogEntry?.song : songsById.get(item.songId);
    if (!song) {
      throw new LibraryError("invalid-data", "Uma das músicas do repertório não foi encontrada.");
    }

    const publicItemId = derivePublicItemId(shareId, item.id);
    sources.push({ publicItemId, songId: song.id, source: item.source });

    return {
      id: publicItemId,
      position: index + 1,
      title: song.title,
      artist: song.artist,
      // Sem tom conhecido (música só com metadados), não há tom a publicar nem a transpor.
      ...(song.originalKey ? { originalKey: song.originalKey } : {}),
      transposeSemitones: transposableKey(song) ? item.transposeSemitones : 0,
      content: catalogEntry
        ? toCatalogPublicContent(catalogEntry)
        : toPublicContent(song as SongRecord, authorizedSongIds.has(song.id)),
      // Só o momento é público; as anotações do item nunca entram.
      ...(item.moment ? { moment: item.moment } : {}),
    };
  });

  const result = publicShareSnapshotSchema.safeParse({
    name: repertoire.name,
    description: repertoire.description,
    ...(repertoire.mass
      ? { mass: { title: repertoire.mass.title, ...(includeMassDate ? { date: repertoire.mass.date } : {}) } }
      : {}),
    items,
  });
  if (!result.success) {
    throw new LibraryError("invalid-data", "O repertório tem dados que não podem ser publicados.");
  }

  return { snapshot: result.data, contentHash: hashSnapshot(result.data), sources };
}
