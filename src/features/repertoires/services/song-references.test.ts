import { describe, expect, it } from "vitest";

import { findLibraryIntegrityIssues, findLibrarySong } from "@/features/library/domain/library";
import { parseLibraryDocument } from "@/features/library/data/library-storage";
import { createLibraryBackup, parseLibraryBackupDocument } from "@/features/library/services/library-backup";
import { versionedLibrary } from "@/test/fixtures";

import type { Repertoire } from "../domain/repertoire";
import { appendRepertoireItem, findRepertoiresUsingSong, hasSongInRepertoire } from "./repertoire-items";
import { getRepertoireSongHref, resolveRepertoireReadingContext } from "./repertoire-reading-context";
import { buildRepertoireEntries } from "./repertoire-service";

const catalogSong = {
  id: "cat-1",
  title: "Do Catálogo",
  artist: "Banda Imaginária",
  originalKey: "G" as const,
  contentType: "original" as const,
  chordPro: "[G]Letra",
  chordProAvailable: true,
};

const dates = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

function repertoireWith(items: Repertoire["items"]): Repertoire {
  return { ...dates, id: "r1", name: "Show", description: "", revision: 1, items };
}

const mixed = repertoireWith([
  { id: "a", songId: "cat-1", source: "catalog", position: 1, transposeSemitones: 0 },
  { id: "b", songId: "song-caminhos", source: "personal", position: 2, transposeSemitones: 2, notes: "Violão" },
  { id: "c", songId: "cat-sumiu", source: "catalog", position: 3, transposeSemitones: 0 },
]);

describe("itens com origem", () => {
  it("resolve cada item pela própria origem", () => {
    const entries = buildRepertoireEntries(mixed.items, versionedLibrary.songs, [catalogSong]);

    expect(entries.map((entry) => entry.song?.title)).toEqual(["Do Catálogo", "Caminhos", undefined]);
    expect(entries[2].song).toBeNull();
  });

  it("não procura uma música particular no catálogo, nem o contrário", () => {
    const library = { songs: versionedLibrary.songs, catalogSongs: [{ ...catalogSong, id: "song-caminhos" }] };

    expect(findLibrarySong(library, "personal", "song-caminhos")?.title).toBe("Caminhos");
    expect(findLibrarySong(library, "catalog", "song-caminhos")?.title).toBe("Do Catálogo");
    expect(findLibrarySong(library, "catalog", "cat-1")).toBeUndefined();
  });

  it("o leitor contextual segue a origem do item", () => {
    expect(getRepertoireSongHref("r1", mixed.items[0])).toBe("/catalogo/cat-1?repertoireId=r1&itemId=a");
    expect(getRepertoireSongHref("r1", mixed.items[1])).toBe("/musicas/song-caminhos?repertoireId=r1&itemId=b");
  });

  it("o contexto só vale para a origem certa", () => {
    const reference = { repertoireId: "r1", itemId: "a" };

    expect(resolveRepertoireReadingContext([mixed], "cat-1", reference, "catalog")).not.toBeNull();
    expect(resolveRepertoireReadingContext([mixed], "cat-1", reference, "personal")).toBeNull();
  });

  it("duplicidade considera a origem", () => {
    expect(hasSongInRepertoire(mixed.items, "catalog", "cat-1")).toBe(true);
    expect(hasSongInRepertoire(mixed.items, "personal", "cat-1")).toBe(false);
  });

  it("inclui com origem explícita, sem copiar a cifra", () => {
    const items = appendRepertoireItem([], "cat-9", "novo", "catalog");

    expect(items).toEqual([{ id: "novo", songId: "cat-9", source: "catalog", position: 1, transposeSemitones: 0 }]);
  });

  it("uma música do catálogo não bloqueia excluir uma particular com o mesmo ID", () => {
    const sameId = repertoireWith([{ id: "x", songId: "song-caminhos", source: "catalog", position: 1, transposeSemitones: 0 }]);

    expect(findRepertoiresUsingSong([sameId], "song-caminhos")).toEqual([]);
    expect(findRepertoiresUsingSong([mixed], "song-caminhos")).toHaveLength(1);
  });

  it("a mesma música do catálogo tem tom independente em cada repertório", () => {
    const first = repertoireWith([{ id: "1", songId: "cat-1", source: "catalog", position: 1, transposeSemitones: 0 }]);
    const second = { ...first, id: "r2", items: [{ ...first.items[0], id: "2", transposeSemitones: 2 }] };

    const [a] = buildRepertoireEntries(first.items, [], [catalogSong]);
    const [b] = buildRepertoireEntries(second.items, [], [catalogSong]);
    expect(a.preferredKey).toBeNull();
    expect(b.preferredKey).toBe("A");
  });
});

describe("compatibilidade com dados antigos", () => {
  const legacyItem = { id: "i1", songId: "song-caminhos", position: 1, transposeSemitones: 3, notes: "Nota" };
  const legacy = {
    schemaVersion: 1,
    songs: versionedLibrary.songs.map((song) => {
      const copy: Partial<typeof song> = { ...song };
      delete copy.revision;
      return copy;
    }),
    repertoires: [{ ...dates, id: "r1", name: "Antigo", description: "", items: [legacyItem] }],
  };

  it("itens da versão 1 viram referências particulares, sem perder nada", () => {
    const result = parseLibraryDocument(legacy);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.library.repertoires[0].items[0]).toEqual({ ...legacyItem, source: "personal" });
    }
  });

  it("a versão 1 não aceita referências ao catálogo", () => {
    const tampered = {
      ...legacy,
      repertoires: [{ ...legacy.repertoires[0], items: [{ ...legacyItem, source: "catalog" }] }],
    };

    expect(parseLibraryDocument(tampered).status).toBe("invalid");
  });

  it("músicas do catálogo não precisam estar no arquivo; as particulares sim", () => {
    const library = {
      songs: [],
      repertoires: [repertoireWith([{ id: "a", songId: "cat-1", source: "catalog", position: 1, transposeSemitones: 0 }])],
    };
    expect(findLibraryIntegrityIssues(library)).toEqual([]);

    library.repertoires[0].items.push({ id: "b", songId: "ausente", source: "personal", position: 2, transposeSemitones: 0 });
    expect(findLibraryIntegrityIssues(library)).toContain("Há repertórios que apontam para músicas inexistentes.");
  });
});

describe("backup", () => {
  it("sem catálogo, mantém a versão 1 e o formato anterior", () => {
    const backup = createLibraryBackup(versionedLibrary, new Date("2026-11-11T00:00:00.000Z"));

    expect(backup.schemaVersion).toBe(1);
    expect(JSON.stringify(backup)).not.toContain('"source"');
    expect(parseLibraryBackupDocument(JSON.parse(JSON.stringify(backup)))).toMatchObject({ status: "ok" });
  });

  it("com catálogo, usa a versão 2 e guarda a origem de cada item", () => {
    const library = { songs: versionedLibrary.songs, repertoires: [mixed] };

    const backup = createLibraryBackup(library, new Date("2026-11-11T00:00:00.000Z"));

    expect(backup.schemaVersion).toBe(2);
    expect(backup.repertoires[0].items.map((item) => item.source)).toEqual(["catalog", "personal", "catalog"]);
    expect(JSON.stringify(backup)).not.toContain("chordProAvailable");
    const parsed = parseLibraryBackupDocument(JSON.parse(JSON.stringify(backup)));
    expect(parsed.status).toBe("ok");
    if (parsed.status === "ok") {
      expect(parsed.library.repertoires[0].items[0]).toMatchObject({ source: "catalog", songId: "cat-1" });
    }
  });
});
