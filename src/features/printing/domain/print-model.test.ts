import { describe, expect, it } from "vitest";

import type { CatalogSongView } from "@/features/library/domain/library";
import type { Repertoire } from "@/features/repertoires/domain/repertoire";
import { buildRepertoireEntries } from "@/features/repertoires/services/repertoire-service";
import type { PublicShareSnapshot } from "@/features/sharing/domain/public-share";
import type { Song } from "@/features/songs/domain/song";

import {
  buildRepertoirePrint,
  buildSharePrint,
  buildSongPrint,
  itemHeading,
  parsePrintFormat,
  parseSemitones,
  summarizePrint,
} from "./print-model";

const at = "2026-11-01T00:00:00.000Z";
const song = (id: string, fields: Partial<Song> = {}): Song =>
  ({
    id,
    title: `Música ${id}`,
    artist: "Autora",
    originalKey: "D",
    contentType: "original",
    chordPro: "[D]Vinde, [G]povo",
    revision: 1,
    createdAt: at,
    updatedAt: at,
    ...fields,
  }) as Song;

const catalogWithChords: CatalogSongView = {
  id: "cat-1",
  title: "Pão e Vinho",
  artist: "Coral",
  originalKey: "G",
  contentType: "original",
  chordPro: "[G]Trigo moído",
  chordProAvailable: true,
};
// Sem permissão de exibição, a projeção do catálogo nem traz a cifra.
const catalogWithoutDisplay: CatalogSongView = {
  id: "cat-2",
  title: "Ponte de Papel",
  artist: "Grupo",
  originalKey: "Am",
  contentType: "authorized",
  chordProAvailable: false,
};

const repertoire: Pick<Repertoire, "items"> = {
  items: [
    // Fora de ordem de propósito: vale `position`.
    { id: "i3", songId: "cat-2", source: "catalog", position: 3, transposeSemitones: 0 },
    { id: "i1", songId: "a", source: "personal", position: 1, transposeSemitones: 2, moment: "entrada", notes: "NOTA PRIVADA" },
    { id: "i2", songId: "cat-1", source: "catalog", position: 2, transposeSemitones: -1, moment: "comunhao" },
    { id: "i4", songId: "sumiu", source: "personal", position: 4, transposeSemitones: 0, moment: "encerramento" },
    { id: "i5", songId: "link", source: "personal", position: 5, transposeSemitones: 0 },
    { id: "i6", songId: "acordes", source: "personal", position: 6, transposeSemitones: 0, moment: "acao-de-gracas" },
  ],
};

const songs = [
  song("a"),
  song("link", { contentType: "external-link", chordPro: undefined, sourceUrl: "https://example.com" } as Partial<Song>),
  song("acordes", { chordPro: "{comment: Solo}\n[C] [G]" }),
];
const entries = buildRepertoireEntries(repertoire.items, songs, [catalogWithChords, catalogWithoutDisplay]);

describe("repertório para impressão", () => {
  it("segue a ordem atual do repertório e usa o momento já configurado em cada item", () => {
    const items = buildRepertoirePrint(entries, "lyrics");
    expect(items.map((item) => item.id)).toEqual(["i1", "i2", "i3", "i4", "i5", "i6"]);
    expect(items.map(itemHeading)).toEqual([
      "Entrada: Música a",
      "Comunhão: Pão e Vinho",
      // Sem momento: identificação neutra, sem inventar uma classificação.
      "Música 3: Ponte de Papel",
      "Encerramento: Música indisponível",
      "Música 5: Música link",
      "Ação de graças: Música acordes",
    ]);
    expect(items[2]).not.toHaveProperty("moment");
  });

  it("imprime cada música no tom do seu item", () => {
    const items = buildRepertoirePrint(entries, "chords");
    expect(items[0]).toMatchObject({ printKey: "E", semitones: 2 });
    // Mesma grafia do leitor: a enarmonia segue a direção da transposição.
    expect(items[1]).toMatchObject({ printKey: "Gb", semitones: -1 });
    expect(items[2]).toMatchObject({ printKey: "Am", semitones: 0 });
  });

  it("aponta cada música sem conteúdo, sem omitir nenhuma e sem expor o que não é autorizado", () => {
    const lyrics = buildRepertoirePrint(entries, "lyrics");
    expect(lyrics.map((item) => item.unavailable ?? "ok")).toEqual(["ok", "ok", "no-content", "missing", "external-link", "no-lyrics"]);
    expect(lyrics[2]).not.toHaveProperty("chordPro");
    expect(lyrics[4]).not.toHaveProperty("chordPro");
    // Só acordes: sem letra, mas imprimível com cifras.
    expect(buildRepertoirePrint(entries, "chords")[5]).toMatchObject({ chordPro: "{comment: Solo}\n[C] [G]" });
    expect(summarizePrint(lyrics)).toMatchObject({ total: 6, printable: 2 });
  });

  it("anotações particulares não entram no papel", () => {
    expect(JSON.stringify(buildRepertoirePrint(entries, "chords"))).not.toContain("NOTA PRIVADA");
  });
});

describe("música individual", () => {
  it("usa o tom em que está sendo lida", () => {
    expect(buildSongPrint(song("a"), 3, "chords")).toMatchObject({ printKey: "F", semitones: 3, chordPro: "[D]Vinde, [G]povo" });
    expect(buildSongPrint(song("a"), 0, "lyrics")).toMatchObject({ printKey: "D" });
  });

  it("música do catálogo sem permissão de exibição não tem o que imprimir", () => {
    expect(buildSongPrint(catalogWithoutDisplay, 0, "chords")).toMatchObject({ unavailable: "no-content" });
  });
});

describe("link público", () => {
  const share: PublicShareSnapshot = {
    name: "Missa",
    description: "",
    items: [
      { id: "b", position: 2, title: "Não incluída", artist: "", transposeSemitones: 0, content: { kind: "none" } },
      { id: "a", position: 1, title: "Com cifra", artist: "X", originalKey: "C", transposeSemitones: 2, moment: "entrada", content: { kind: "chordpro", chordPro: "[C]Vem" } },
      { id: "c", position: 3, title: "Retirada", artist: "", transposeSemitones: 0, content: { kind: "unavailable" } },
    ],
  };

  it("só o retrato publicado, na ordem, com o momento publicado", () => {
    const items = buildSharePrint(share, "chords");
    expect(items.map(itemHeading)).toEqual(["Entrada: Com cifra", "Música 2: Não incluída", "Música 3: Retirada"]);
    expect(items[0]).toMatchObject({ printKey: "D", chordPro: "[C]Vem" });
    expect(items.slice(1).map((item) => item.unavailable)).toEqual(["not-shared", "not-shared"]);
  });
});

describe("parâmetros da URL", () => {
  it("aceita só os formatos conhecidos e tons de -11 a 11", () => {
    expect(parsePrintFormat("letras", "chords")).toBe("lyrics");
    expect(parsePrintFormat("cifra", "lyrics")).toBe("chords");
    expect(parsePrintFormat("<script>", "lyrics")).toBe("lyrics");
    expect(parsePrintFormat(["letras"], "chords")).toBe("chords");
    expect(parseSemitones("-3")).toBe(-3);
    expect(parseSemitones("12")).toBe(0);
    expect(parseSemitones("2.5")).toBe(0);
    expect(parseSemitones(undefined)).toBe(0);
  });
});
