import { describe, expect, it } from "vitest";

import {
  parseChordPro,
  type ChordProLine,
  type LyricsLine,
  type ParsedChordPro,
} from "./chordpro-parser";
import { transposeParsedChordPro } from "./chordpro-transposition";

const SOURCE = `{title: Caminhos}
{key: G}

{comment: Introdução em G}
[G] [D] [Em] [C]

{start_of_verse}
[G]Hoje vou se[D]guir em G
Linha sem acorde
[N.C.]Parada [%]aqui [Bridge]fim
{end_of_verse}

{start_of_chorus}
[C/E]Caminhos que eu [G]não tracei
{end_of_chorus}`;

function lyricsLines(parsed: ParsedChordPro): LyricsLine[] {
  return parsed.sections
    .flatMap((section) => section.lines)
    .filter((line): line is LyricsLine => line.kind === "lyrics");
}

function lyricsText(parsed: ParsedChordPro): string[] {
  return lyricsLines(parsed).map((line) => line.segments.map((s) => s.text).join(""));
}

function chords(parsed: ParsedChordPro): (string | null)[] {
  return lyricsLines(parsed).flatMap((line) => line.segments.map((s) => s.chord));
}

describe("transposeParsedChordPro", () => {
  const parsed = parseChordPro(SOURCE);
  const transposed = transposeParsedChordPro(parsed, 2);

  it("transpõe apenas os acordes reconhecidos", () => {
    expect(chords(transposed)).toEqual([
      "A",
      "E",
      "F#m",
      "D",
      "A",
      "E",
      null,
      "N.C.",
      "%",
      "Bridge",
      "D/F#",
      "A",
    ]);
  });

  it("preserva as letras, inclusive palavras iguais a nomes de notas", () => {
    expect(lyricsText(transposed)).toEqual(lyricsText(parsed));
    expect(lyricsText(transposed)).toContain("Hoje vou seguir em G");
  });

  it("preserva linhas, seções e o número de trechos", () => {
    expect(transposed.sections.map((s) => s.kind)).toEqual(parsed.sections.map((s) => s.kind));
    expect(transposed.sections.map((s) => s.lines.length)).toEqual(
      parsed.sections.map((s) => s.lines.length),
    );
    expect(lyricsLines(transposed).map((l) => l.segments.length)).toEqual(
      lyricsLines(parsed).map((l) => l.segments.length),
    );
  });

  it("mantém cada acorde associado à mesma sílaba", () => {
    const original = lyricsLines(parsed).find((line) => line.segments[1]?.text === "guir em G");
    const result = lyricsLines(transposed).find((line) => line.segments[1]?.text === "guir em G");

    expect(original?.segments[1].chord).toBe("D");
    expect(result?.segments[0]).toEqual({ chord: "A", text: "Hoje vou se" });
    expect(result?.segments[1]).toEqual({ chord: "E", text: "guir em G" });
  });

  it("não altera comentários nem metadados", () => {
    const comment = transposed.sections[0].lines[0] as ChordProLine;
    expect(comment).toEqual({ kind: "comment", text: "Introdução em G" });
    expect(transposed.metadata).toEqual({ title: "Caminhos", key: "G" });
  });

  it("não modifica o modelo original", () => {
    const snapshot = structuredClone(parsed);
    transposeParsedChordPro(parsed, 5);
    expect(parsed).toEqual(snapshot);
  });

  it("preserva a grafia original com deslocamento zero", () => {
    const flats = parseChordPro("[Db]Um [C#m]dois [Gb/Bb]três");
    expect(transposeParsedChordPro(flats, 0)).toEqual(flats);
  });

  it("repassa a preferência de acidentes", () => {
    const result = transposeParsedChordPro(parseChordPro("[C]Um"), 1, "flat");
    expect(chords(result)).toEqual(["Db"]);
  });
});
