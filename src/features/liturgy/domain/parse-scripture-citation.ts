import { BIBLE_BOOKS, scriptureReferenceSchema, type ScriptureReference } from "./scripture";

// Jó (livro de Jó) e Jo (João) são livros distintos: não retirar o acento.
const normalize = (value: string) => value.normalize("NFC").replace(/\s/g, "").toLowerCase();
const books = new Map(BIBLE_BOOKS.flatMap(([id, abbreviation]) => [[normalize(id), id], [normalize(abbreviation), id]]));
const SINGLE_CHAPTER = new Set(["ab", "fm", "2jo", "3jo", "jd"]);

/** Retira observações, preservando a numeração dupla dos salmos. Nunca lê o texto da leitura. */
export function cleanScriptureCitation(value: string): string {
  return value.normalize("NFC").replace(/[–—]/g, "-").replace(/\((?!\d)[^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Citações do Lecionário: versículos descontínuos e múltiplos capítulos explícitos.
 * Uma forma ambígua ou longa demais não vira um trecho mais amplo por aproximação.
 */
export function parseScriptureCitation(value: string): ScriptureReference[] | null {
  const citation = cleanScriptureCitation(value);
  const match = /^(\d?\s*[A-Za-zÀ-ÿ]+)\s*(.+)$/.exec(citation);
  if (!match) return null;
  const book = books.get(normalize(match[1]));
  if (!book) return null;
  const result: ScriptureReference[] = [];
  for (let part of match[2].split(";")) {
    part = part.trim();
    // A numeração comparável do salmo é a hebraica, dentro dos parênteses.
    if (book === "sl") part = part.replace(/^\d+[AB]?\s*\((\d+)[AB]?\)/i, "$1");
    let chapter: number;
    let verses: string | undefined;
    const chapterAndVerses = /^(\d+)(?:\s*,\s*(.+))?$/.exec(part);
    if (chapterAndVerses) {
      chapter = Number(chapterAndVerses[1]);
      verses = chapterAndVerses[2];
    } else if (SINGLE_CHAPTER.has(book)) {
      chapter = 1;
      verses = part;
    } else return null;
    if (SINGLE_CHAPTER.has(book) && !part.includes(",")) { chapter = 1; verses = part; }
    if (!verses) result.push({ book, chapter });
    else {
      for (const segment of verses.split(".")) {
        const range = /^\s*(\d+)[a-d]*(?:\s*-\s*(\d+)[a-d]*)?\s*$/i.exec(segment);
        if (!range) return null;
        result.push({ book, chapter, verseStart: Number(range[1]), ...(range[2] ? { verseEnd: Number(range[2]) } : {}) });
      }
    }
  }
  if (!result.length || result.length > 6 || result.some((entry) => !scriptureReferenceSchema.safeParse(entry).success)) return null;
  return result;
}
