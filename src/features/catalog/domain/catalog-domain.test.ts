import { describe, expect, it } from "vitest";

import { buildSearchTokens, buildSortTitle, parseSearchQuery, tokenize } from "./catalog-search";
import {
  canDisplayChordPro,
  canShareChordPro,
  catalogRightsInputSchema,
  catalogSearchSchema,
  catalogSongInputSchema,
  catalogSongViewSchema,
  publicationProblems,
  toCatalogSongView,
  type CatalogSong,
} from "./catalog-song";

const rights = {
  basis: "original-work" as const,
  evidence: "Obra da casa.",
  displayChordPro: true,
  shareChordPro: true,
  linkExternalSource: true,
  approvedBy: "admin-1",
  approvedAt: "2026-11-01T00:00:00.000Z",
};

const song: CatalogSong = {
  id: "c1",
  title: "Coração de Estrada",
  artist: "Banda Imaginária",
  originalKey: "G",
  contentType: "original",
  chordPro: "[G]Letra",
  status: "published",
  rights,
  revision: 1,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  publishedAt: "2026-11-01T00:00:00.000Z",
  liturgy: null,
  metadataSources: [],
};

describe("normalização da busca", () => {
  it("ignora acentos, maiúsculas e espaços extras", () => {
    expect(tokenize("  CORAÇÃO   de  Estrada ")).toEqual(["coracao", "de", "estrada"]);
  });

  it("palavras de título e artista, sem repetição", () => {
    expect(buildSearchTokens("Estrada Azul", "Banda Estrada")).toEqual(["estrada", "azul", "banda"]);
  });

  it("consulta vazia lista o catálogo", () => {
    expect(parseSearchQuery("   ")).toEqual([]);
  });

  it("limita a quantidade de termos", () => {
    expect(parseSearchQuery(Array.from({ length: 30 }, (_, index) => `p${index}`).join(" "))).toHaveLength(12);
  });

  it("ordenação usa o título normalizado", () => {
    expect(buildSortTitle("Águas  Claras")).toBe("aguas claras");
  });
});

describe("parâmetros públicos", () => {
  it("aplica padrões e limites", () => {
    expect(catalogSearchSchema.parse({})).toEqual({ q: "", page: 1, pageSize: 12 });
    expect(catalogSearchSchema.safeParse({ page: "51" }).success).toBe(false);
    expect(catalogSearchSchema.safeParse({ pageSize: "25" }).success).toBe(false);
    expect(catalogSearchSchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
    expect(catalogSearchSchema.safeParse({ page: "abc" }).success).toBe(false);
    expect(catalogSearchSchema.safeParse({ status: "draft" }).success).toBe(false);
  });
});

describe("direitos e publicação", () => {
  it("só redistribui o que também pode ser exibido", () => {
    expect(
      catalogRightsInputSchema.safeParse({ basis: "license", evidence: "x", displayChordPro: false, shareChordPro: true })
        .success,
    ).toBe(false);
  });

  it("exige fundamento; a evidência pode ficar para depois do rascunho, mas não da publicação", () => {
    expect(catalogRightsInputSchema.safeParse({ basis: "x", evidence: "", displayChordPro: false, shareChordPro: false }).success).toBe(false);
    expect(
      catalogRightsInputSchema.safeParse({ basis: "public-metadata", evidence: "", displayChordPro: false, shareChordPro: false })
        .success,
    ).toBe(true);
    expect(publicationProblems({ ...song, rights: { ...rights, evidence: " " } })).toEqual([
      "Registre a evidência dos direitos antes de publicar.",
    ]);
    expect(publicationProblems(song)).toEqual([]);
  });

  it("valida os dados musicais com as mesmas regras das músicas particulares", () => {
    const base = { rights: { basis: "license", evidence: "x", displayChordPro: false, shareChordPro: false } };
    expect(catalogSongInputSchema.safeParse({ ...base, song: { title: "", artist: "A", originalKey: "G", contentType: "original" } }).success).toBe(false);
    expect(catalogSongInputSchema.safeParse({ ...base, song: { title: "T", artist: "A", originalKey: "G", contentType: "external-link", sourceUrl: "javascript:x" } }).success).toBe(false);
  });

  it("o tipo Autorizada sozinho não permite exibir a cifra", () => {
    const authorized = { ...song, contentType: "authorized" as const, rights: { ...rights, displayChordPro: false, shareChordPro: false } };
    expect(canDisplayChordPro(authorized)).toBe(false);
    expect(toCatalogSongView(authorized)).not.toHaveProperty("chordPro");
  });

  it("rascunhos e despublicadas não exibem nem redistribuem", () => {
    for (const status of ["draft", "unpublished"] as const) {
      expect(canDisplayChordPro({ ...song, status })).toBe(false);
      expect(canShareChordPro({ ...song, status })).toBe(false);
    }
  });

  it("exibir não implica redistribuir", () => {
    const displayOnly = { ...song, rights: { ...rights, shareChordPro: false } };
    expect(canDisplayChordPro(displayOnly)).toBe(true);
    expect(canShareChordPro(displayOnly)).toBe(false);
  });
});

describe("projeção pública", () => {
  it("não carrega direitos, evidências, revisão nem estado", () => {
    const view = toCatalogSongView(song);

    expect(Object.keys(view).sort()).toEqual(["artist", "chordPro", "chordProAvailable", "contentType", "id", "originalKey", "title"]);
    expect(JSON.stringify(view)).not.toContain("Obra da casa");
    expect(catalogSongViewSchema.safeParse({ ...view, revision: 1 }).success).toBe(false);
  });

  it("um link externo nunca tem cifra", () => {
    const external: CatalogSong = { ...song, contentType: "external-link", sourceUrl: "https://example.com/x" } as CatalogSong;
    expect(toCatalogSongView(external)).toEqual({
      id: "c1",
      title: song.title,
      artist: song.artist,
      originalKey: "G",
      contentType: "external-link",
      sourceUrl: "https://example.com/x",
      chordProAvailable: false,
    });
  });
});

describe("música só com metadados", () => {
  const metadataRights = { basis: "public-metadata", evidence: "", displayChordPro: false, shareChordPro: false };

  it("aceita cadastro sem cifra, sem tom e sem autoria confirmada", () => {
    const parsed = catalogSongInputSchema.safeParse({
      song: { title: "Senhor, Deus de nossos pais", artist: "", contentType: "metadata-only" },
      rights: metadataRights,
      metadataSources: [{ title: "CNBB — Hinário", url: "https://www.cnbb.org.br/x" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("recusa cifra ou link em uma música só com metadados", () => {
    const base = { rights: metadataRights };
    expect(
      catalogSongInputSchema.safeParse({ ...base, song: { title: "T", artist: "", contentType: "metadata-only", chordPro: "[G]x" } })
        .success,
    ).toBe(false);
    expect(
      catalogSongInputSchema.safeParse({
        ...base,
        song: { title: "T", artist: "", contentType: "metadata-only", sourceUrl: "https://example.com" },
      }).success,
    ).toBe(false);
  });

  it("a cifra particular continua exigindo tom e autoria", () => {
    const base = { rights: metadataRights };
    expect(catalogSongInputSchema.safeParse({ ...base, song: { title: "T", artist: "A", contentType: "original", chordPro: "[G]x" } }).success).toBe(false);
  });

  it("recusa fonte de metadados com endereço inseguro", () => {
    const parsed = catalogSongInputSchema.safeParse({
      song: { title: "T", artist: "", contentType: "metadata-only" },
      rights: metadataRights,
      metadataSources: [{ title: "x", url: "javascript:alert(1)" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("a projeção pública mostra só metadados e as fontes, nunca cifra", () => {
    const metadataOnly = {
      ...song,
      contentType: "metadata-only",
      chordPro: undefined,
      originalKey: undefined,
      artist: "",
      compositionReference: "Hinário Litúrgico 2, p. 45",
      metadataSources: [{ title: "CNBB", url: "https://www.cnbb.org.br/x", accessedAt: "2026-11-14" }],
      rights: { ...rights, basis: "public-metadata", displayChordPro: false, shareChordPro: false },
    } as unknown as CatalogSong;
    const view = toCatalogSongView(metadataOnly);
    expect(view).toEqual({
      id: "c1",
      title: song.title,
      artist: "",
      contentType: "metadata-only",
      chordProAvailable: false,
      compositionReference: "Hinário Litúrgico 2, p. 45",
      metadataSources: [{ title: "CNBB", url: "https://www.cnbb.org.br/x", accessedAt: "2026-11-14" }],
    });
    expect(catalogSongViewSchema.safeParse(view).success).toBe(true);
  });

  it("link externo sem permissão de exibir o link aparece só com metadados", () => {
    const external = {
      ...song,
      contentType: "external-link",
      chordPro: undefined,
      sourceUrl: "https://example.com/x",
      rights: { ...rights, displayChordPro: false, shareChordPro: false, linkExternalSource: false },
    } as unknown as CatalogSong;
    const view = toCatalogSongView(external);
    expect(view.contentType).toBe("metadata-only");
    expect(JSON.stringify(view)).not.toContain("example.com");
  });
});

