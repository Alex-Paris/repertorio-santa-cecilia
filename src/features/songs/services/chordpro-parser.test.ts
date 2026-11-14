import { describe, expect, it } from "vitest";

import { groupSegmentsIntoWords, parseChordPro, parseLyricsLine } from "./chordpro-parser";

describe("parseLyricsLine", () => {
  it("associa cada acorde ao trecho que ele inicia", () => {
    expect(parseLyricsLine("[G]Hoje vou se[D]guir").segments).toEqual([
      { chord: "G", text: "Hoje vou se" },
      { chord: "D", text: "guir" },
    ]);
  });

  it("preserva o texto antes do primeiro acorde", () => {
    expect(parseLyricsLine("Por um [C]lugar").segments).toEqual([
      { chord: null, text: "Por um " },
      { chord: "C", text: "lugar" },
    ]);
  });

  it("aceita acordes com extensões e baixo invertido", () => {
    const chords = parseLyricsLine("[F#m7b5]a [A/C#]b [Dsus4]c").segments.map((s) => s.chord);
    expect(chords).toEqual(["F#m7b5", "A/C#", "Dsus4"]);
  });

  it("mantém acorde no fim da linha e acordes consecutivos", () => {
    expect(parseLyricsLine("fim[G][D]").segments).toEqual([
      { chord: null, text: "fim" },
      { chord: "G", text: "" },
      { chord: "D", text: "" },
    ]);
  });

  it("identifica linhas sem acordes e linhas só de acordes", () => {
    expect(parseLyricsLine("Apenas letra")).toMatchObject({ hasChords: false, hasLyrics: true });
    expect(parseLyricsLine("[G] [D]")).toMatchObject({ hasChords: true, hasLyrics: false });
  });

  it("descarta colchetes vazios e mantém colchete não fechado como texto", () => {
    expect(parseLyricsLine("a[]b").segments.map((s) => s.text).join("")).toBe("ab");
    expect(parseLyricsLine("texto [G").segments).toEqual([{ chord: null, text: "texto [G" }]);
  });
});

describe("parseChordPro", () => {
  it("extrai metadados sem expô-los como linhas", () => {
    const { metadata, sections } = parseChordPro(
      "{title: Caminhos}\n{artist: Exemplo}\n{key: G}\n\n[G]Letra",
    );
    expect(metadata).toEqual({ title: "Caminhos", artist: "Exemplo", key: "G" });
    expect(sections).toHaveLength(1);
    expect(sections[0].lines).toHaveLength(1);
  });

  it("reconhece seções de estrofe e refrão, inclusive pelas abreviações", () => {
    const { sections } = parseChordPro(
      "{start_of_verse}\n[G]Um\n{end_of_verse}\n{soc}\n[C]Dois\n{eoc}",
    );
    expect(sections.map((section) => section.kind)).toEqual(["verse", "chorus"]);
  });

  it("separa blocos livres por linhas em branco", () => {
    const { sections } = parseChordPro("Um\nDois\n\n\nTrês");
    expect(sections.map((section) => section.lines.length)).toEqual([2, 1]);
  });

  it("interpreta comentários e ignora diretivas desconhecidas e linhas com #", () => {
    const { sections } = parseChordPro("{comment: Intro}\n{capo: 2}\n# nota interna\n[G]Letra");
    expect(sections[0].lines.map((line) => line.kind)).toEqual(["comment", "lyrics"]);
  });

  it("aceita quebras de linha do Windows e entrada vazia", () => {
    expect(parseChordPro("Um\r\nDois").sections[0].lines).toHaveLength(2);
    expect(parseChordPro("").sections).toEqual([]);
  });
});

describe("groupSegmentsIntoWords", () => {
  it("mantém uma palavra dividida por acorde no mesmo grupo", () => {
    const words = groupSegmentsIntoWords(parseLyricsLine("[G]Hoje vou se[D]guir").segments);

    expect(words.map((word) => word.map((piece) => piece.text).join(""))).toEqual([
      "Hoje ",
      "vou ",
      "seguir",
    ]);
    expect(words[0][0].chord).toBe("G");
    expect(words[2].map((piece) => piece.chord)).toEqual([null, "D"]);
  });

  it("não perde acordes de linhas sem letra", () => {
    const words = groupSegmentsIntoWords(parseLyricsLine("[G] [D]").segments);
    expect(words.flat().map((piece) => piece.chord)).toEqual(["G", "D"]);
  });
});
