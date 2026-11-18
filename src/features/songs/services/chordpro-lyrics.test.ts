import { describe, expect, it } from "vitest";

import { parseChordPro } from "./chordpro-parser";
import { extractLyrics, hasLyrics, lyricsFromChordPro, lyricsToPlainText } from "./chordpro-lyrics";
import { transposeParsedChordPro } from "./chordpro-transposition";

const SONG = `{title: Canto de Teste}
{artist: Autora}
{key: D}
# comentário interno do arquivo

{comment: Intro}
[D] [G] [A] [D]

[D]Vinde, povo de [G]Deus, lou[A]vai ao Se[D]nhor,
can[D]tai com ale[G]gria, ó [A]povo do a[D]mor!

{start_of_chorus}
[G]Glória, [A]glória, ao Se[D]nhor do [Bm]céu!
[G]Hosana, ho[A]sana, ao [D]Deus fiel!
{end_of_chorus}

{comment: Refrão 2x}

{start_of_verse}
[D]Ó Maria, Mãe de [G]Jesus,
[A]intercede por [D]nós.
{end_of_verse}`;

describe("letra a partir do ChordPro", () => {
  const lyrics = lyricsFromChordPro(SONG);
  const text = lyricsToPlainText(lyrics);

  it("tira acordes sem partir palavras e preserva acentos e pontuação", () => {
    expect(text).toContain("Vinde, povo de Deus, louvai ao Senhor,");
    expect(text).toContain("cantai com alegria, ó povo do amor!");
    expect(text).toContain("Ó Maria, Mãe de Jesus,");
    expect(text).not.toMatch(/\[|\]/);
    for (const chord of ["Bm", " G ", " A "]) {
      expect(text).not.toContain(chord);
    }
  });

  it("não mostra diretivas, metadados nem comentários do arquivo", () => {
    expect(text).not.toContain("title");
    expect(text).not.toContain("Canto de Teste");
    expect(text).not.toContain("Autora");
    expect(text).not.toContain("{");
    expect(text).not.toContain("comentário interno");
  });

  it("mantém estrofes, refrão e a indicação de repetição, sem a introdução instrumental", () => {
    expect(lyrics.sections.map((section) => section.kind)).toEqual(["plain", "chorus", "plain", "verse"]);
    expect(lyrics.sections[2]).toEqual({ kind: "plain", lines: [{ kind: "comment", text: "Refrão 2x" }] });
    expect(text).not.toContain("Intro");
    expect(lyrics.sections[1]!.lines).toEqual([
      { kind: "text", text: "Glória, glória, ao Senhor do céu!" },
      { kind: "text", text: "Hosana, hosana, ao Deus fiel!" },
    ]);
  });

  it("reaproveita o parser: mesma interpretação da cifra, sem regex genérica sobre o texto", () => {
    const parsed = parseChordPro(SONG);
    expect(extractLyrics(parsed)).toEqual(lyrics);
    // A transposição só mexe nos acordes: a letra é a mesma em qualquer tom.
    expect(extractLyrics(transposeParsedChordPro(parsed, 5))).toEqual(lyrics);
  });

  it("espaços deixados para afastar acordes viram um espaço; linhas só de acordes somem", () => {
    const result = lyricsFromChordPro("[C]Vem    [G]  Senhor\n[Am] [F]\nfica    conosco");
    expect(lyricsToPlainText(result)).toBe("Vem Senhor\nfica conosco");
  });

  it("cifra só de acordes não tem letra; texto vazio também não", () => {
    expect(hasLyrics(lyricsFromChordPro("{comment: Solo}\n[C] [G] [Am] [F]"))).toBe(false);
    expect(hasLyrics(lyricsFromChordPro(""))).toBe(false);
    expect(hasLyrics(lyricsFromChordPro("{comment: Refrão 2x}"))).toBe(false);
  });
});
