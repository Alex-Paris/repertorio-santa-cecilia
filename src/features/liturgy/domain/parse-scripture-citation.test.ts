import { describe, expect, it } from "vitest";

import { cleanScriptureCitation, parseScriptureCitation } from "./parse-scripture-citation";

describe("referências consultadas", () => {
  it("preserva versículos descontínuos, sem inventar os trechos intermediários", () => {
    expect(parseScriptureCitation("Is 42,1-4.6-7")).toEqual([
      { book: "is", chapter: 42, verseStart: 1, verseEnd: 4 },
      { book: "is", chapter: 42, verseStart: 6, verseEnd: 7 },
    ]);
    expect(parseScriptureCitation("Is 63,16b-17.19b;64,2b-7")).toEqual([
      { book: "is", chapter: 63, verseStart: 16, verseEnd: 17 },
      { book: "is", chapter: 63, verseStart: 19 },
      { book: "is", chapter: 64, verseStart: 2, verseEnd: 7 },
    ]);
  });
  it("converte a numeração dupla do salmo e remove só a nota do refrão", () => {
    expect(parseScriptureCitation("Sl 18(19A),2-3.4-5 (R. 5a)")).toEqual([
      { book: "sl", chapter: 19, verseStart: 2, verseEnd: 3 },
      { book: "sl", chapter: 19, verseStart: 4, verseEnd: 5 },
    ]);
    expect(cleanScriptureCitation("Mc 1,7–11 (Jesus batizado por João)")).toBe("Mc 1,7-11");
  });
  it("aceita livros numerados e livros de capítulo único", () => {
    expect(parseScriptureCitation("Jó 19,1-4")?.[0].book).toBe("job");
    expect(parseScriptureCitation("Jo 19,1-4")?.[0].book).toBe("jo");
    expect(parseScriptureCitation("1 Cor 15,20-26.28")?.[0]).toEqual({ book: "1cor", chapter: 15, verseStart: 20, verseEnd: 26 });
    expect(parseScriptureCitation("Jd 20b-25")).toEqual([{ book: "jd", chapter: 1, verseStart: 20, verseEnd: 25 }]);
  });
  it.each(["Gn 1,1-2,2", "Livro desconhecido 1,2", "Mt 0,1", "Mt 4,22-18", "Sl 18,1.2.3.4.5.6.7", "Rm 10,9 texto solto"])("não aproxima a referência %s", (citation) => {
    expect(parseScriptureCitation(citation)).toBeNull();
  });
});
