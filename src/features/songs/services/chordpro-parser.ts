export interface ChordSegment {
  /** Acorde tocado no início de `text`, ou `null` quando o trecho não tem acorde. */
  chord: string | null;
  text: string;
}

export interface LyricsLine {
  kind: "lyrics";
  segments: ChordSegment[];
  hasChords: boolean;
  hasLyrics: boolean;
}

export interface CommentLine {
  kind: "comment";
  text: string;
}

export type ChordProLine = LyricsLine | CommentLine;

export type ChordProSectionKind = "plain" | "verse" | "chorus";

export interface ChordProSection {
  kind: ChordProSectionKind;
  lines: ChordProLine[];
}

export interface ChordProMetadata {
  title?: string;
  artist?: string;
  key?: string;
}

export interface ParsedChordPro {
  metadata: ChordProMetadata;
  sections: ChordProSection[];
}

const DIRECTIVE_PATTERN = /^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i;
const CHORD_PATTERN = /\[([^[\]]*)\]/g;

/** Separa uma linha de letra em trechos, cada um com o acorde que o inicia. */
export function parseLyricsLine(source: string): LyricsLine {
  const segments: ChordSegment[] = [];
  let cursor = 0;
  let pendingChord: string | null = null;

  for (const match of source.matchAll(CHORD_PATTERN)) {
    const text = source.slice(cursor, match.index);
    if (text || pendingChord) {
      segments.push({ chord: pendingChord, text });
    }
    pendingChord = match[1].trim() || null;
    cursor = match.index + match[0].length;
  }

  const remainingText = source.slice(cursor);
  if (remainingText || pendingChord) {
    segments.push({ chord: pendingChord, text: remainingText });
  }

  return {
    kind: "lyrics",
    segments,
    hasChords: segments.some((segment) => segment.chord !== null),
    hasLyrics: segments.some((segment) => segment.text.trim() !== ""),
  };
}

/** Interpreta o subconjunto de ChordPro usado pela plataforma. Diretivas desconhecidas são ignoradas. */
export function parseChordPro(source: string): ParsedChordPro {
  const metadata: ChordProMetadata = {};
  const sections: ChordProSection[] = [];
  let current: ChordProSection = { kind: "plain", lines: [] };

  function closeSection(nextKind: ChordProSectionKind = "plain"): void {
    if (current.lines.length > 0) {
      sections.push(current);
    }
    current = { kind: nextKind, lines: [] };
  }

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (line.trimStart().startsWith("#")) {
      continue;
    }

    if (line.trim() === "") {
      if (current.kind === "plain") {
        closeSection();
      }
      continue;
    }

    const directive = line.trim().match(DIRECTIVE_PATTERN);
    if (!directive) {
      current.lines.push(parseLyricsLine(line));
      continue;
    }

    const value = directive[2]?.trim() ?? "";

    switch (directive[1].toLowerCase()) {
      case "title":
      case "t":
        metadata.title = value;
        break;
      case "artist":
        metadata.artist = value;
        break;
      case "key":
        metadata.key = value;
        break;
      case "comment":
      case "c":
        if (value) {
          current.lines.push({ kind: "comment", text: value });
        }
        break;
      case "start_of_verse":
      case "sov":
        closeSection("verse");
        break;
      case "start_of_chorus":
      case "soc":
        closeSection("chorus");
        break;
      case "end_of_verse":
      case "eov":
      case "end_of_chorus":
      case "eoc":
        closeSection();
        break;
    }
  }

  closeSection();

  return { metadata, sections };
}

/**
 * Agrupa os trechos em palavras inteiras. A quebra de linha em telas estreitas
 * só pode ocorrer entre palavras, sem separar um acorde da sílaba em que ele cai.
 */
export function groupSegmentsIntoWords(
  segments: readonly ChordSegment[],
): ChordSegment[][] {
  const words: ChordSegment[][] = [];
  let wordIsOpen = false;

  for (const segment of segments) {
    const pieces = segment.text.match(/\S+\s*|\s+/g) ?? [""];

    pieces.forEach((text, index) => {
      const piece: ChordSegment = {
        chord: index === 0 ? segment.chord : null,
        text,
      };
      const currentWord = words.at(-1);

      if (wordIsOpen && currentWord) {
        currentWord.push(piece);
      } else {
        words.push([piece]);
      }

      wordIsOpen = !/\s$/.test(text);
    });
  }

  return words;
}
