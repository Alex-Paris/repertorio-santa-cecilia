// @vitest-environment node
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { RepertoireRecord } from "@/features/repertoires/domain/repertoire";
import { publicShareSnapshotSchema } from "@/features/sharing/domain/public-share";
import type { SongRecord } from "@/features/songs/domain/song";

import { buildShareSnapshot, hashSnapshot } from "./share-snapshot";

const dates = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" };

const original: SongRecord = {
  ...dates,
  id: "s-original",
  title: "Própria",
  artist: "Autora",
  originalKey: "G",
  contentType: "original",
  chordPro: "[G]Letra própria",
};

const authorized: SongRecord = {
  ...dates,
  id: "s-autorizada",
  title: "Autorizada",
  artist: "Terceiro",
  originalKey: "C",
  contentType: "authorized",
  chordPro: "[C]Letra de terceiro",
};

const external: SongRecord = {
  ...dates,
  id: "s-externa",
  title: "Externa",
  artist: "Site",
  originalKey: "D",
  contentType: "external-link",
  sourceUrl: "https://example.com/cifra",
};

const empty: SongRecord = { ...original, id: "s-vazia", title: "Sem cifra", chordPro: undefined };

const repertoire: RepertoireRecord = {
  ...dates,
  id: "r-privado",
  name: "Show",
  description: "Domingo",
  items: [
    { id: "i-3", songId: external.id, source: "personal" as const, position: 3, transposeSemitones: 0 },
    { id: "i-1", songId: original.id, source: "personal" as const, position: 1, transposeSemitones: 2, notes: "SEGREDO DE ENSAIO" },
    { id: "i-2", songId: authorized.id, source: "personal" as const, position: 2, transposeSemitones: -1, notes: "outra nota" },
  ],
};

const songs = [original, authorized, external, empty];

function build(authorizedIds: string[] = [], source = repertoire, shareId = "share-1") {
  return buildShareSnapshot({
    shareId,
    repertoire: source,
    songs,
    authorizedSongIds: new Set(authorizedIds),
  });
}

describe("construção da publicação", () => {
  it("segue a ordem do repertório e renumera as posições", () => {
    const { snapshot } = build();

    expect(snapshot.items.map((item) => item.title)).toEqual(["Própria", "Autorizada", "Externa"]);
    expect(snapshot.items.map((item) => item.position)).toEqual([1, 2, 3]);
  });

  it("publica nome, descrição, artista, tom original e deslocamento", () => {
    const { snapshot } = build();

    expect(snapshot).toMatchObject({ name: "Show", description: "Domingo" });
    expect(snapshot.items[0]).toMatchObject({
      artist: "Autora",
      originalKey: "G",
      transposeSemitones: 2,
    });
  });

  it("contém somente os campos públicos, nos dois níveis", () => {
    const { snapshot } = build([original.id]);

    expect(Object.keys(snapshot).sort()).toEqual(["description", "items", "name"]);
    expect(Object.keys(snapshot.items[0]).sort()).toEqual([
      "artist",
      "content",
      "id",
      "originalKey",
      "position",
      "title",
      "transposeSemitones",
    ]);
  });

  it("nunca inclui anotações nem identificadores privados", () => {
    const text = JSON.stringify(build([original.id, authorized.id]).snapshot);

    for (const forbidden of ["SEGREDO", "outra nota", "notes", "r-privado", "s-original", "i-1", "ownerId"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("inclui a cifra original confirmada", () => {
    expect(build([original.id]).snapshot.items[0].content).toEqual({
      kind: "chordpro",
      chordPro: original.chordPro,
    });
  });

  it("omite a cifra sem confirmação", () => {
    expect(build().snapshot.items[0].content).toEqual({ kind: "none" });
  });

  it("não considera o tipo “Autorizada” como autorização", () => {
    expect(build().snapshot.items[1].content).toEqual({ kind: "none" });
    expect(JSON.stringify(build().snapshot)).not.toContain("Letra de terceiro");
  });

  it("confirma cada música separadamente", () => {
    const { snapshot } = build([authorized.id]);

    expect(snapshot.items[0].content.kind).toBe("none");
    expect(snapshot.items[1].content.kind).toBe("chordpro");
  });

  it("publica o endereço de um link externo, sem cifra e sem transposição", () => {
    const source = {
      ...repertoire,
      items: repertoire.items.map((item) =>
        item.songId === external.id ? { ...item, transposeSemitones: 5 } : item,
      ),
    };
    const item = build([], source).snapshot.items[2];

    expect(item.content).toEqual({ kind: "external-link", sourceUrl: external.sourceUrl });
    expect(item.transposeSemitones).toBe(0);
  });

  it("recusa autorização para link externo", () => {
    expect(() => build([external.id])).toThrow(expect.objectContaining({ code: "invalid-data" }));
  });

  it("recusa autorização para música sem cifra", () => {
    const source = {
      ...repertoire,
      items: [{ id: "i-9", songId: empty.id, source: "personal" as const, position: 1, transposeSemitones: 0 }],
    };

    expect(() => build([empty.id], source)).toThrow(expect.objectContaining({ code: "invalid-data" }));
  });

  it("trata autorização de música fora do repertório como prévia desatualizada", () => {
    expect(() => build([empty.id])).toThrow(expect.objectContaining({ code: "share-preview-outdated" }));
  });

  it("recusa repertório vazio", () => {
    expect(() => build([], { ...repertoire, items: [] })).toThrow(
      expect.objectContaining({ code: "invalid-data" }),
    );
  });

  it("recusa item cuja música não existe", () => {
    const source = {
      ...repertoire,
      items: [{ id: "i-x", songId: "inexistente", source: "personal" as const, position: 1, transposeSemitones: 0 }],
    };

    expect(() => build([], source)).toThrow(expect.objectContaining({ code: "invalid-data" }));
  });

  it("guarda a origem fora do conteúdo público", () => {
    const { sources, snapshot } = build();

    expect(sources.map((source) => source.songId)).toEqual([original.id, authorized.id, external.id]);
    expect(sources[0].publicItemId).toBe(snapshot.items[0].id);
  });
});

describe("identificação do conteúdo", () => {
  it("o ID público do item se mantém entre atualizações", () => {
    expect(build().snapshot.items[0].id).toBe(build([original.id]).snapshot.items[0].id);
  });

  it("o hash não depende do ID da publicação, para valer entre prévia e confirmação", () => {
    expect(build([], repertoire, "previa").contentHash).toBe(build([], repertoire, "outra").contentHash);
  });

  it("o hash muda com o conteúdo publicado", () => {
    expect(build([original.id]).contentHash).not.toBe(build().contentHash);
  });

  it("o hash muda com a ordem das músicas", () => {
    const moved = {
      ...repertoire,
      items: repertoire.items.map((item) => ({ ...item, position: 4 - item.position })),
    };

    expect(hashSnapshot(build([], moved).snapshot)).not.toBe(build().contentHash);
  });
});

describe("contrato público", () => {
  it("recusa campos fora da lista", () => {
    const { snapshot } = build();

    expect(publicShareSnapshotSchema.safeParse({ ...snapshot, ownerId: "x" }).success).toBe(false);
    expect(
      publicShareSnapshotSchema.safeParse({
        ...snapshot,
        items: [{ ...snapshot.items[0], notes: "x" }],
      }).success,
    ).toBe(false);
  });

  it("recusa um endereço externo inseguro", () => {
    const { snapshot } = build();

    expect(
      publicShareSnapshotSchema.safeParse({
        ...snapshot,
        items: [{ ...snapshot.items[0], content: { kind: "external-link", sourceUrl: "javascript:alert(1)" } }],
      }).success,
    ).toBe(false);
  });
});

describe("músicas do catálogo", () => {
  const catalogBase = { title: "Do Catálogo", artist: "Banda Imaginária", originalKey: "D" as const };
  const catalogSongs = new Map([
    ["cat-livre", { song: { ...catalogBase, id: "cat-livre", contentType: "original" as const, chordPro: "[D]Livre" }, published: true, canShareChordPro: true }],
    ["cat-so-exibe", { song: { ...catalogBase, id: "cat-so-exibe", contentType: "authorized" as const, chordPro: "[D]Restrita" }, published: true, canShareChordPro: false }],
    ["cat-externa", { song: { ...catalogBase, id: "cat-externa", contentType: "external-link" as const, sourceUrl: "https://example.com/c" }, published: true, canShareChordPro: false }],
    ["cat-fora", { song: { ...catalogBase, id: "cat-fora", contentType: "original" as const, chordPro: "[D]Fora" }, published: false, canShareChordPro: false }],
    ["cat-metadados", { song: { id: "cat-metadados", title: "Só Metadados", artist: "", contentType: "metadata-only" as const }, published: true, canShareChordPro: true }],
  ]);
  const mixed = {
    ...repertoire,
    items: [
      { id: "m1", songId: "cat-livre", source: "catalog" as const, position: 1, transposeSemitones: 2, notes: "PRIVADA" },
      { id: "m2", songId: original.id, source: "personal" as const, position: 2, transposeSemitones: 0 },
      { id: "m3", songId: "cat-so-exibe", source: "catalog" as const, position: 3, transposeSemitones: 0 },
      { id: "m4", songId: "cat-externa", source: "catalog" as const, position: 4, transposeSemitones: 0 },
      { id: "m5", songId: "cat-fora", source: "catalog" as const, position: 5, transposeSemitones: 0 },
    ],
  };

  function buildMixed(authorized: string[] = []) {
    return buildShareSnapshot({
      shareId: "share-1",
      repertoire: mixed,
      songs,
      catalogSongs,
      authorizedSongIds: new Set(authorized),
    });
  }

  it("aplica as permissões da plataforma, não a confirmação do dono", () => {
    const { snapshot } = buildMixed();

    expect(snapshot.items.map((item) => item.content.kind)).toEqual([
      "chordpro",
      "none",
      "none",
      "external-link",
      "unavailable",
    ]);
    expect(snapshot.items[0]).toMatchObject({ transposeSemitones: 2, title: "Do Catálogo" });
    expect(JSON.stringify(snapshot)).not.toContain("Restrita");
    expect(JSON.stringify(snapshot)).not.toContain("PRIVADA");
  });

  it("a música particular continua dependendo da confirmação do dono", () => {
    expect(buildMixed([original.id]).snapshot.items[1].content.kind).toBe("chordpro");
  });

  it("a confirmação do dono não libera a cifra de uma música do catálogo", () => {
    expect(() => buildMixed(["cat-so-exibe"])).toThrow(expect.objectContaining({ code: "share-preview-outdated" }));
  });

  it("música só com metadados entra sem cifra e sem transposição, mesmo com permissão de redistribuir", () => {
    const { snapshot } = buildShareSnapshot({
      shareId: "share-1",
      repertoire: {
        ...repertoire,
        items: [{ id: "m9", songId: "cat-metadados", source: "catalog" as const, position: 1, transposeSemitones: 0 }],
      },
      songs,
      catalogSongs,
      authorizedSongIds: new Set(),
    });
    expect(snapshot.items[0]).toMatchObject({ title: "Só Metadados", content: { kind: "none" }, transposeSemitones: 0 });
    expect(snapshot.items[0]).not.toHaveProperty("originalKey");
  });

  it("guarda a origem de cada item fora do conteúdo público", () => {
    const { sources, snapshot } = buildMixed();

    expect(sources.map((source) => source.source)).toEqual(["catalog", "personal", "catalog", "catalog", "catalog"]);
    expect(JSON.stringify(snapshot)).not.toContain("cat-livre");
  });
});

describe("repertório de missa", () => {
  const mass = { date: "2026-11-22", celebrationId: "2026-11-22-cristo-rei", title: "Cristo Rei" };
  const massRepertoire = {
    ...repertoire,
    mass,
    items: repertoire.items.map((item) => ({
      ...item,
      notes: "ANOTACAO PRIVADA",
      ...(item.position === 1 ? { moment: "entrada" as const } : {}),
    })),
  };

  function buildMass(includeMassDate?: boolean) {
    return buildShareSnapshot({
      shareId: "share-1",
      repertoire: massRepertoire,
      songs,
      authorizedSongIds: new Set(),
      includeMassDate,
    });
  }

  it("publica o nome da celebração e o momento de cada música, sem a data", () => {
    const { snapshot } = buildMass();

    expect(snapshot.mass).toEqual({ title: "Cristo Rei" });
    expect(snapshot.items[0].moment).toBe("entrada");
    expect(snapshot.items[1]).not.toHaveProperty("moment");
    expect(JSON.stringify(snapshot)).not.toContain("2026-11-22");
    expect(publicShareSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it("a data só entra quando o proprietário escolhe", () => {
    expect(buildMass(true).snapshot.mass).toEqual({ title: "Cristo Rei", date: "2026-11-22" });
    expect(buildMass(false).snapshot.mass).toEqual({ title: "Cristo Rei" });
  });

  it("nunca publica anotações nem a referência interna da celebração", () => {
    const text = JSON.stringify(buildMass(true).snapshot);
    expect(text).not.toContain("ANOTACAO PRIVADA");
    expect(text).not.toContain("celebrationId");
    expect(text).not.toContain("2026-11-22-cristo-rei");
  });

  it("escolher a data muda o hash da prévia; o momento também", () => {
    expect(buildMass(true).contentHash).not.toBe(buildMass(false).contentHash);
    const withoutMoment = buildShareSnapshot({
      shareId: "share-1",
      repertoire: { ...massRepertoire, items: repertoire.items.map((item) => ({ ...item, notes: "ANOTACAO PRIVADA" })) },
      songs,
      authorizedSongIds: new Set(),
    });
    expect(withoutMoment.contentHash).not.toBe(buildMass(false).contentHash);
  });

  it("um repertório antigo, sem missa, mantém o mesmo conteúdo e o mesmo hash", () => {
    const { snapshot, contentHash } = buildShareSnapshot({
      shareId: "share-1",
      repertoire,
      songs,
      authorizedSongIds: new Set(),
    });

    expect(snapshot).not.toHaveProperty("mass");
    expect(snapshot.items.every((item) => !("moment" in item))).toBe(true);
    // Mesmo cálculo de antes da Etapa 2E.2: publicações existentes não ficam "desatualizadas".
    const legacyHash = createHash("sha256")
      .update(
        JSON.stringify({
          name: snapshot.name,
          description: snapshot.description,
          items: snapshot.items.map(({ title, artist, originalKey, transposeSemitones, content }) => ({
            title,
            artist,
            originalKey,
            transposeSemitones,
            content,
          })),
        }),
      )
      .digest("hex");
    expect(contentHash).toBe(legacyHash);
    expect(hashSnapshot(snapshot)).toBe(legacyHash);
  });
});
