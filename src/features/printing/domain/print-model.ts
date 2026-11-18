import { momentLabel, type LiturgicalMomentId } from "@/features/liturgy/domain/vocabulary";
import type { RepertoireEntry } from "@/features/repertoires/services/repertoire-service";
import type { PublicShareItem, PublicShareSnapshot } from "@/features/sharing/domain/public-share";
import type { MusicalKey } from "@/features/songs/domain/musical-key";
import type { MusicalSong } from "@/features/songs/domain/song";
import { transposeKey } from "@/features/songs/domain/transposition";
import { hasLyrics, lyricsFromChordPro } from "@/features/songs/services/chordpro-lyrics";

/**
 * Impressão (Etapa 2F.2). Quatro formatos: música com cifra, música só com a letra, repertório só
 * com as letras (contínuo) e repertório com as cifras (uma música por folha). Só entra no papel
 * o que a pessoa já pode ler na tela: os dados vêm das mesmas fontes autorizadas do leitor.
 */
export const PRINT_FORMATS = ["lyrics", "chords"] as const;
export type PrintFormat = (typeof PRINT_FORMATS)[number];

export const SONG_PRINT_LABELS: Record<PrintFormat, string> = { chords: "Com cifra", lyrics: "Somente letra" };
export const REPERTOIRE_PRINT_LABELS: Record<PrintFormat, string> = { lyrics: "Somente letras", chords: "Com cifras" };

/** Valor da URL (`?formato=letras|cifras`, `?modo=letra|cifra`); qualquer outro vale o padrão. */
export function parsePrintFormat(value: unknown, fallback: PrintFormat): PrintFormat {
  if (value === "letras" || value === "letra" || value === "lyrics") return "lyrics";
  if (value === "cifras" || value === "cifra" || value === "chords") return "chords";
  return fallback;
}

export function printFormatParam(format: PrintFormat, plural: boolean): string {
  return format === "lyrics" ? (plural ? "letras" : "letra") : plural ? "cifras" : "cifra";
}

/** Deslocamento de tom vindo da URL; fora de -11..11 vale zero. */
export function parseSemitones(value: unknown): number {
  const number = typeof value === "string" && /^-?\d{1,2}$/.test(value) ? Number(value) : 0;
  return number >= -11 && number <= 11 ? number : 0;
}

export type PrintUnavailableReason = "missing" | "external-link" | "no-content" | "no-lyrics" | "not-shared";

/** Textos objetivos para o papel e a pré-visualização. Nunca mostram o conteúdo não autorizado. */
export const UNAVAILABLE_TEXT: Record<PrintUnavailableReason, string> = {
  missing: "Música indisponível: ela saiu da biblioteca ou do catálogo.",
  "external-link": "A cifra está numa fonte externa e não é reproduzida aqui.",
  "no-content": "Letra e cifra não disponíveis para impressão.",
  "no-lyrics": "Esta cifra não tem letra cadastrada, só acordes.",
  "not-shared": "A letra e a cifra desta música não foram incluídas neste compartilhamento.",
};

export interface PrintItem {
  id: string;
  /** Posição na ordem do repertório, a partir de 1. */
  position: number;
  /** Momento já configurado no item do repertório; nunca deduzido. */
  moment?: LiturgicalMomentId;
  /** "Entrada", "Comunhão"… ou, sem momento, a identificação neutra "Música 3". */
  label: string;
  title: string;
  artist: string;
  /** Tom em que a música será impressa (o do item, já transposto). */
  printKey?: string;
  semitones: number;
  /** Presente só quando há conteúdo autorizado para o formato escolhido. */
  chordPro?: string;
  unavailable?: PrintUnavailableReason;
}

export function itemLabel(position: number, moment?: LiturgicalMomentId): string {
  return moment ? momentLabel(moment) : `Música ${position}`;
}

/** "Entrada: Nome da música". */
export function itemHeading(item: Pick<PrintItem, "label" | "title">): string {
  return `${item.label}: ${item.title}`;
}

type SongContent = Pick<MusicalSong, "contentType" | "originalKey"> & { chordPro?: string };

/** Decide o que imprimir de uma música, com o mesmo critério do leitor. */
export function songPrintContent(
  song: SongContent | null,
  format: PrintFormat,
): { chordPro: string } | { unavailable: PrintUnavailableReason } {
  if (!song) return { unavailable: "missing" };
  if (song.contentType === "external-link") return { unavailable: "external-link" };
  const chordPro = song.chordPro?.trim() ? song.chordPro : undefined;
  if (!chordPro) return { unavailable: "no-content" };
  if (format === "lyrics" && !hasLyrics(lyricsFromChordPro(chordPro))) return { unavailable: "no-lyrics" };
  return { chordPro };
}

function keyFor(originalKey: MusicalKey | undefined, semitones: number, contentType?: string): string | undefined {
  if (!originalKey || contentType === "external-link") return undefined;
  return semitones === 0 ? originalKey : transposeKey(originalKey, semitones);
}

/** Música individual, no tom em que está sendo lida. */
export function buildSongPrint(
  song: MusicalSong & { chordPro?: string },
  semitones: number,
  format: PrintFormat,
): PrintItem {
  return {
    id: song.id,
    position: 1,
    label: "",
    title: song.title,
    artist: song.artist,
    printKey: keyFor(song.originalKey, semitones, song.contentType),
    semitones,
    ...songPrintContent(song, format),
  };
}

/**
 * Repertório da conta: na ordem atual dos itens (`position`), com o momento e o tom de cada
 * item. Anotações particulares não entram no papel.
 */
export function buildRepertoirePrint(entries: readonly RepertoireEntry[], format: PrintFormat): PrintItem[] {
  return entries.map((entry, index) => {
    const position = index + 1;
    const song = entry.song as (MusicalSong & { chordPro?: string }) | null;
    const semitones = entry.item.transposeSemitones;
    return {
      id: entry.item.id,
      position,
      ...(entry.item.moment ? { moment: entry.item.moment } : {}),
      label: itemLabel(position, entry.item.moment),
      title: song?.title ?? "Música indisponível",
      artist: song?.artist ?? "",
      printKey: song ? keyFor(song.originalKey, semitones, song.contentType) : undefined,
      semitones,
      ...songPrintContent(song, format),
    };
  });
}

function shareContent(item: PublicShareItem, format: PrintFormat) {
  switch (item.content.kind) {
    case "chordpro":
      return songPrintContent({ contentType: "original", originalKey: item.originalKey, chordPro: item.content.chordPro }, format);
    case "external-link":
      return { unavailable: "external-link" as const };
    case "none":
    case "unavailable":
      return { unavailable: "not-shared" as const };
  }
}

/** Link público: só o que o retrato publicado contém; revogado, não há o que imprimir. */
export function buildSharePrint(snapshot: PublicShareSnapshot, format: PrintFormat): PrintItem[] {
  return [...snapshot.items]
    .sort((a, b) => a.position - b.position)
    .map((item, index) => {
      const position = index + 1;
      return {
        id: item.id,
        position,
        ...(item.moment ? { moment: item.moment } : {}),
        label: itemLabel(position, item.moment),
        title: item.title,
        artist: item.artist,
        printKey: item.content.kind === "external-link" ? undefined : keyFor(item.originalKey, item.transposeSemitones),
        semitones: item.transposeSemitones,
        ...shareContent(item, format),
      };
    });
}

export interface PrintSummary {
  total: number;
  printable: number;
  unavailable: PrintItem[];
}

export function summarizePrint(items: readonly PrintItem[]): PrintSummary {
  const unavailable = items.filter((item) => item.unavailable);
  return { total: items.length, printable: items.length - unavailable.length, unavailable };
}
