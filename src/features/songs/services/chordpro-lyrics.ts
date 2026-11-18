import { parseChordPro, type ChordProSectionKind, type LyricsLine, type ParsedChordPro } from "./chordpro-parser";

/**
 * Letra sem cifra, derivada da mesma interpretação do ChordPro usada no leitor, na apresentação
 * e na impressão. Nada é gravado: a letra é sempre calculada a partir da cifra armazenada.
 */
export type LyricsLineView =
  /** Verso cantado, com acentos e pontuação preservados. */
  | { kind: "text"; text: string }
  /** Indicação textual da própria cifra (`{comment: 2x}`, "Refrão", "Solo"). */
  | { kind: "comment"; text: string };

export interface LyricsSection {
  kind: ChordProSectionKind;
  lines: LyricsLineView[];
}

export interface LyricsDocument {
  sections: LyricsSection[];
}

/**
 * Texto cantado de uma linha: os trechos entre acordes, na ordem. Um acorde no meio da palavra
 * (`Se[A]nhor`) não a separa; espaços deixados só para afastar acordes viram um espaço.
 */
export function lyricsText(line: LyricsLine): string {
  return line.segments
    .map((segment) => segment.text)
    .join("")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Remove acordes, diretivas e metadados técnicos, preservando estrofes, refrões, indicações
 * textuais e repetições escritas na cifra. Linhas só de acordes (introdução, passagens) somem;
 * seções que ficam vazias também.
 */
export function extractLyrics(parsed: ParsedChordPro): LyricsDocument {
  const sections: LyricsSection[] = [];

  for (const section of parsed.sections) {
    const lines: LyricsLineView[] = [];
    let instrumental = false;
    for (const line of section.lines) {
      if (line.kind === "comment") {
        lines.push({ kind: "comment", text: line.text });
        continue;
      }
      const text = line.hasLyrics ? lyricsText(line) : "";
      if (text) {
        lines.push({ kind: "text", text });
      } else {
        instrumental = true;
      }
    }
    const hasText = lines.some((line) => line.kind === "text");
    // "Intro" sobre uma linha de acordes é instrumental e sai; uma indicação sozinha
    // ("Refrão 2x") é parte da ordem do canto e fica.
    if (hasText || (lines.length > 0 && !instrumental)) {
      sections.push({ kind: section.kind, lines });
    }
  }

  return { sections };
}

export function lyricsFromChordPro(source: string): LyricsDocument {
  return extractLyrics(parseChordPro(source));
}

/** Há algo para cantar? Uma cifra só de acordes não tem letra a mostrar nem a imprimir. */
export function hasLyrics(document: LyricsDocument): boolean {
  return document.sections.some((section) => section.lines.some((line) => line.kind === "text"));
}

/** Texto corrido, uma estrofe por parágrafo: útil em testes e na conferência dos PDFs. */
export function lyricsToPlainText(document: LyricsDocument): string {
  return document.sections
    .map((section) => section.lines.map((line) => line.text).join("\n"))
    .join("\n\n");
}
