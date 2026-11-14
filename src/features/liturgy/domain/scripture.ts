import { z } from "zod";

/** Cânon católico (73 livros), com as abreviaturas usadas nos lecionários do Brasil. */
export const BIBLE_BOOKS = [
  ["gn", "Gn", "Gênesis"], ["ex", "Ex", "Êxodo"], ["lv", "Lv", "Levítico"], ["nm", "Nm", "Números"],
  ["dt", "Dt", "Deuteronômio"], ["js", "Js", "Josué"], ["jz", "Jz", "Juízes"], ["rt", "Rt", "Rute"],
  ["1sm", "1Sm", "1 Samuel"], ["2sm", "2Sm", "2 Samuel"], ["1rs", "1Rs", "1 Reis"], ["2rs", "2Rs", "2 Reis"],
  ["1cr", "1Cr", "1 Crônicas"], ["2cr", "2Cr", "2 Crônicas"], ["esd", "Esd", "Esdras"], ["ne", "Ne", "Neemias"],
  ["tb", "Tb", "Tobias"], ["jt", "Jt", "Judite"], ["est", "Est", "Ester"], ["1mc", "1Mc", "1 Macabeus"],
  ["2mc", "2Mc", "2 Macabeus"], ["job", "Jó", "Jó"], ["sl", "Sl", "Salmos"], ["pr", "Pr", "Provérbios"],
  ["ecl", "Ecl", "Eclesiastes"], ["ct", "Ct", "Cântico dos Cânticos"], ["sb", "Sb", "Sabedoria"],
  ["eclo", "Eclo", "Eclesiástico"], ["is", "Is", "Isaías"], ["jr", "Jr", "Jeremias"], ["lm", "Lm", "Lamentações"],
  ["br", "Br", "Baruc"], ["ez", "Ez", "Ezequiel"], ["dn", "Dn", "Daniel"], ["os", "Os", "Oseias"],
  ["jl", "Jl", "Joel"], ["am", "Am", "Amós"], ["ab", "Ab", "Abdias"], ["jn", "Jn", "Jonas"],
  ["mq", "Mq", "Miqueias"], ["na", "Na", "Naum"], ["hab", "Hab", "Habacuc"], ["sf", "Sf", "Sofonias"],
  ["ag", "Ag", "Ageu"], ["zc", "Zc", "Zacarias"], ["ml", "Ml", "Malaquias"],
  ["mt", "Mt", "Mateus"], ["mc", "Mc", "Marcos"], ["lc", "Lc", "Lucas"], ["jo", "Jo", "João"],
  ["at", "At", "Atos dos Apóstolos"], ["rm", "Rm", "Romanos"], ["1cor", "1Cor", "1 Coríntios"],
  ["2cor", "2Cor", "2 Coríntios"], ["gl", "Gl", "Gálatas"], ["ef", "Ef", "Efésios"], ["fl", "Fl", "Filipenses"],
  ["cl", "Cl", "Colossenses"], ["1ts", "1Ts", "1 Tessalonicenses"], ["2ts", "2Ts", "2 Tessalonicenses"],
  ["1tm", "1Tm", "1 Timóteo"], ["2tm", "2Tm", "2 Timóteo"], ["tt", "Tt", "Tito"], ["fm", "Fm", "Filêmon"],
  ["hb", "Hb", "Hebreus"], ["tg", "Tg", "Tiago"], ["1pd", "1Pd", "1 Pedro"], ["2pd", "2Pd", "2 Pedro"],
  ["1jo", "1Jo", "1 João"], ["2jo", "2Jo", "2 João"], ["3jo", "3Jo", "3 João"], ["jd", "Jd", "Judas"],
  ["ap", "Ap", "Apocalipse"],
] as const satisfies readonly (readonly [string, string, string])[];

export type BibleBookId = (typeof BIBLE_BOOKS)[number][0];
export const BIBLE_BOOK_IDS = BIBLE_BOOKS.map(([id]) => id) as [BibleBookId, ...BibleBookId[]];

const BOOKS_BY_ID = new Map<string, { abbreviation: string; name: string }>(
  BIBLE_BOOKS.map(([id, abbreviation, name]) => [id, { abbreviation, name }]),
);

export function bookName(id: string): string {
  return BOOKS_BY_ID.get(id)?.name ?? id;
}

/**
 * Trecho bíblico comparável. Sem versículos, vale o capítulo inteiro.
 * Salmos usam a numeração hebraica (a das Bíblias atuais); a exibição acrescenta a litúrgica.
 */
export interface ScriptureReference {
  book: BibleBookId;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

const MAX_CHAPTER = 150;
const MAX_VERSE = 176;

export const scriptureReferenceSchema: z.ZodType<ScriptureReference> = z
  .strictObject({
    book: z.enum(BIBLE_BOOK_IDS, { error: "Escolha um livro da Bíblia." }),
    chapter: z
      .number({ error: "Informe o capítulo." })
      .int("Informe o capítulo.")
      .min(1, "Informe o capítulo.")
      .max(MAX_CHAPTER, "Capítulo inválido."),
    verseStart: z.number().int().min(1).max(MAX_VERSE).optional(),
    verseEnd: z.number().int().min(1).max(MAX_VERSE).optional(),
  })
  .refine((reference) => reference.verseEnd === undefined || reference.verseStart !== undefined, {
    message: "Informe o versículo inicial.",
    path: ["verseStart"],
  })
  .refine(
    (reference) =>
      reference.verseStart === undefined ||
      reference.verseEnd === undefined ||
      reference.verseEnd >= reference.verseStart,
    { message: "O versículo final vem depois do inicial.", path: ["verseEnd"] },
  );

/** Número do salmo na numeração litúrgica (grega), para os casos de correspondência simples. */
function liturgicalPsalmNumber(hebrew: number): number | null {
  if ((hebrew >= 11 && hebrew <= 113) || (hebrew >= 117 && hebrew <= 146)) {
    return hebrew - 1;
  }
  return null;
}

/** Formato dos lecionários do Brasil: "Jo 6,51-58", "Sl 22(23)". */
export function formatScriptureReference(reference: ScriptureReference): string {
  const book = BOOKS_BY_ID.get(reference.book)?.abbreviation ?? reference.book;
  const liturgical = reference.book === "sl" ? liturgicalPsalmNumber(reference.chapter) : null;
  const chapter = liturgical === null ? String(reference.chapter) : `${liturgical}(${reference.chapter})`;

  if (reference.verseStart === undefined) {
    return `${book} ${chapter}`;
  }
  const verses =
    reference.verseEnd === undefined || reference.verseEnd === reference.verseStart
      ? String(reference.verseStart)
      : `${reference.verseStart}-${reference.verseEnd}`;
  return `${book} ${chapter},${verses}`;
}

/** Os trechos se encontram: mesmo livro e capítulo, com versículos em comum. */
export function scriptureOverlaps(a: ScriptureReference, b: ScriptureReference): boolean {
  if (a.book !== b.book || a.chapter !== b.chapter) {
    return false;
  }
  const aStart = a.verseStart ?? 1;
  const aEnd = a.verseStart === undefined ? MAX_VERSE : (a.verseEnd ?? a.verseStart);
  const bStart = b.verseStart ?? 1;
  const bEnd = b.verseStart === undefined ? MAX_VERSE : (b.verseEnd ?? b.verseStart);
  return aStart <= bEnd && bStart <= aEnd;
}

export function sameScriptureReference(a: ScriptureReference, b: ScriptureReference): boolean {
  return (
    a.book === b.book && a.chapter === b.chapter && a.verseStart === b.verseStart && a.verseEnd === b.verseEnd
  );
}
