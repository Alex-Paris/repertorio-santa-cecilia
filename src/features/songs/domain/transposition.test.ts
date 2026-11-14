import { describe, expect, it } from "vitest";

import {
  clampTransposeSemitones,
  formatSemitoneOffset,
  getDefaultAccidentalPreference,
  MAX_TRANSPOSE_SEMITONES,
  MIN_TRANSPOSE_SEMITONES,
  transposeChord,
  transposeKey,
  transposeNote,
} from "./transposition";

describe("exemplos obrigatórios", () => {
  it.each([
    ["G", 2, "A"],
    ["C", 2, "D"],
    ["Am", 2, "Bm"],
    ["Em", 2, "F#m"],
    ["F#m7", 1, "Gm7"],
    ["Bb/D", 2, "C/E"],
    ["D/F#", 2, "E/G#"],
    ["C7(9)", 2, "D7(9)"],
    ["G7sus4", 2, "A7sus4"],
    ["Cadd9", 2, "Dadd9"],
    ["F#m7b5", 1, "Gm7b5"],
  ])("%s %d = %s", (chord, semitones, expected) => {
    expect(transposeChord(chord, semitones)).toBe(expected);
  });
});

describe("as 12 notas", () => {
  const sharps = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const flats = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

  it.each(sharps.map((note, index) => [note, index] as const))(
    "%s + 1 chega à próxima classe de altura",
    (note, index) => {
      expect(transposeNote(note, 1)).toBe(sharps[(index + 1) % 12]);
    },
  );

  it.each(flats.map((note, index) => [note, index] as const))(
    "%s - 1 chega à classe de altura anterior",
    (note, index) => {
      expect(transposeNote(note, -1)).toBe(flats[(index + 11) % 12]);
    },
  );

  it("percorre a oitava inteira a partir de C", () => {
    expect(Array.from({ length: 12 }, (_, i) => transposeNote("C", i, "sharp"))).toEqual(sharps);
  });

  it("entende grafias enarmônicas de entrada", () => {
    expect(transposeNote("Cb", 1)).toBe("C");
    expect(transposeNote("B#", 1)).toBe("C#");
    expect(transposeNote("E#", 1)).toBe("F#");
    expect(transposeNote("Fb", 1)).toBe("F");
  });

  it("devolve sem alteração o que não é nota", () => {
    expect(transposeNote("H", 2)).toBe("H");
    expect(transposeNote("c", 2)).toBe("c");
    expect(transposeNote("", 2)).toBe("");
  });
});

describe("preferência de acidentes", () => {
  it("usa sustenidos para cima e bemóis para baixo por padrão", () => {
    expect(getDefaultAccidentalPreference(3)).toBe("sharp");
    expect(getDefaultAccidentalPreference(-3)).toBe("flat");
    expect(transposeChord("C", 1)).toBe("C#");
    expect(transposeChord("D", -1)).toBe("Db");
  });

  it("aceita preferência explícita, em qualquer direção", () => {
    expect(transposeChord("C", 1, "flat")).toBe("Db");
    expect(transposeChord("D", -1, "sharp")).toBe("C#");
    expect(transposeNote("C", 3, "flat")).toBe("Eb");
    expect(transposeKey("G", -1, "sharp")).toBe("F#");
  });

  it("aplica a mesma preferência à fundamental e ao baixo", () => {
    expect(transposeChord("C/E", 1, "flat")).toBe("Db/F");
    expect(transposeChord("D/A", -1)).toBe("Db/Ab");
    expect(transposeChord("D/A", 1)).toBe("D#/A#");
  });
});

describe("transposição zero", () => {
  it.each(["C#m7", "Dbmaj7", "Gb/Bb", "B#", "Cb", "N.C."])("preserva a grafia de %s", (chord) => {
    expect(transposeChord(chord, 0)).toBe(chord);
    expect(transposeChord(chord, 0, "flat")).toBe(chord);
    expect(transposeChord(chord, 0, "sharp")).toBe(chord);
  });

  it("trata uma oitava inteira como deslocamento nulo", () => {
    expect(transposeChord("Db", 12)).toBe("Db");
    expect(transposeChord("C#", -12)).toBe("C#");
    expect(transposeNote("Gb", 24)).toBe("Gb");
  });
});

describe("transposição positiva e negativa", () => {
  it("transpõe acordes menores nos dois sentidos", () => {
    expect(transposeChord("Am", 3)).toBe("Cm");
    expect(transposeChord("Am", -2)).toBe("Gm");
    expect(transposeChord("C#m", -1)).toBe("Cm");
    expect(transposeChord("Ebm", 2)).toBe("Fm");
  });

  it("transpõe acordes com sétima", () => {
    expect(transposeChord("G7", 2)).toBe("A7");
    expect(transposeChord("Dm7", -2)).toBe("Cm7");
    expect(transposeChord("Bbmaj7", 2)).toBe("Cmaj7");
    expect(transposeChord("CM7", 2)).toBe("DM7");
    expect(transposeChord("C7M", 2)).toBe("D7M");
  });

  it("transpõe a fundamental e o baixo invertido", () => {
    expect(transposeChord("C/G", -2)).toBe("Bb/F");
    expect(transposeChord("Am7/G", 2)).toBe("Bm7/A");
    expect(transposeChord("F#m/C#", 2)).toBe("G#m/D#");
    expect(transposeChord("A/C#", 2)).toBe("B/D#");
  });
});

describe("normalização de valores", () => {
  it("dá a volta na oitava sem perder a nota", () => {
    expect(transposeChord("B", 1)).toBe("C");
    expect(transposeChord("C", -1)).toBe("B");
    expect(transposeChord("A", 14)).toBe("B");
    expect(transposeChord("C", -14)).toBe("Bb");
    expect(transposeChord("G", -11)).toBe("Ab");
    expect(transposeChord("G", 11)).toBe("F#");
  });

  it("preserva o acorde quando o deslocamento não é inteiro", () => {
    expect(transposeChord("C", 1.5)).toBe("C");
    expect(transposeChord("C", Number.NaN)).toBe("C");
  });
});

describe("limites de semitons", () => {
  it("define a faixa de -11 a +11", () => {
    expect(MIN_TRANSPOSE_SEMITONES).toBe(-11);
    expect(MAX_TRANSPOSE_SEMITONES).toBe(11);
  });

  it.each([
    [12, 11],
    [-12, -11],
    [11, 11],
    [-11, -11],
    [0, 0],
  ])("limita %d a %d", (value, expected) => {
    expect(clampTransposeSemitones(value)).toBe(expected);
  });

  it("formata o deslocamento com sinal", () => {
    expect(formatSemitoneOffset(2)).toBe("+2");
    expect(formatSemitoneOffset(-2)).toBe("-2");
    expect(formatSemitoneOffset(0)).toBe("0");
  });
});

describe("extensões e alterações", () => {
  it.each([
    ["Cmaj9", "Dmaj9"],
    ["Cm6", "Dm6"],
    ["C6/9", "D6/9"],
    ["C7/9", "D7/9"],
    ["C9", "D9"],
    ["C11", "D11"],
    ["C13", "D13"],
    ["C5", "D5"],
    ["Csus", "Dsus"],
    ["Csus2", "Dsus2"],
    ["C9sus4", "D9sus4"],
    ["Cdim", "Ddim"],
    ["Cdim7", "Ddim7"],
    ["C°", "D°"],
    ["Cº7", "Dº7"],
    ["Cø", "Dø"],
    ["Caug", "Daug"],
    ["C+", "D+"],
    ["C+5", "D+5"],
    ["C-", "D-"],
    ["C-7", "D-7"],
    ["C7b9", "D7b9"],
    ["C7#9", "D7#9"],
    ["C7#11", "D7#11"],
    ["C7b13", "D7b13"],
    ["C7+", "D7+"],
    ["C7-9", "D7-9"],
    ["C7alt", "D7alt"],
    ["Cm7(b5)", "Dm7(b5)"],
    ["C7(b9,#11)", "D7(b9,#11)"],
    ["C7(9,13)", "D7(9,13)"],
    ["C7M(9)", "D7M(9)"],
    ["Cm(maj7)", "Dm(maj7)"],
    ["CmM7", "DmM7"],
    ["C(add9)", "D(add9)"],
    ["Cmadd9", "Dmadd9"],
    ["Comit3", "Domit3"],
    ["Cno3", "Dno3"],
    ["Cmin7", "Dmin7"],
  ])("%s + 2 = %s", (chord, expected) => {
    expect(transposeChord(chord, 2)).toBe(expected);
  });

  it("não confunde o b de sufixos com bemol", () => {
    expect(transposeChord("Am7b5", -2)).toBe("Gm7b5");
    expect(transposeChord("C7b5/E", 2)).toBe("D7b5/F#");
  });

  it("não confunde o bemol da fundamental com o sufixo", () => {
    expect(transposeChord("Bb5", 2)).toBe("C5");
    expect(transposeChord("Ebmaj7", 1)).toBe("Emaj7");
  });

  it("combina sufixo e baixo com acidentes", () => {
    expect(transposeChord("F#m7b5/C#", 1)).toBe("Gm7b5/D");
    expect(transposeChord("G7(b9)/B", -1)).toBe("Gb7(b9)/Bb");
  });
});

describe("marcações não reconhecidas são preservadas", () => {
  it.each([
    "N.C.",
    "NC",
    "%",
    "x2",
    "Bridge",
    "Coda",
    "Fim",
    "Do",
    "Dó",
    "Add9",
    "Refrão",
    "am",
    "H7",
    "C3",
    "C10",
    "C/H",
    "C/",
    "C/G/B",
    "C7(9",
    "C7)",
    "C##",
    "Cbb",
    "Am I",
    "G maior",
    "",
    "<b>C</b>",
    `C${"7".repeat(40)}`,
  ])("mantém %j", (marking) => {
    expect(transposeChord(marking, 2)).toBe(marking);
    expect(transposeChord(marking, -5)).toBe(marking);
  });
});

describe("tom original e tom exibido", () => {
  it("deriva o tom exibido sem alterar o tom de origem", () => {
    const original = "G";
    expect(transposeKey(original, 2)).toBe("A");
    expect(original).toBe("G");
  });

  it("transpõe tons menores", () => {
    expect(transposeKey("Am", 2)).toBe("Bm");
    expect(transposeKey("Em", 2)).toBe("F#m");
  });

  it("usa no tom a mesma grafia dos acordes", () => {
    expect(transposeKey("C", 1)).toBe(transposeChord("C", 1));
    expect(transposeKey("G", -1)).toBe(transposeChord("G", -1));
  });

  it("mantém a grafia do tom original em deslocamento zero", () => {
    expect(transposeKey("Db", 0)).toBe("Db");
    expect(transposeKey("C#m", 0)).toBe("C#m");
  });
});
