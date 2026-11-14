import { describe, expect, it } from "vitest";

import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import { demoSongs } from "@/features/songs/data/demo-songs";
import { createMemoryStorage } from "@/test/memory-storage";

import {
  CURRENT_SCHEMA_VERSION,
  LIBRARY_STORAGE_KEY,
  parseJsonDocument,
  LIBRARY_MIGRATIONS,
  parseLibraryDocument,
  readStoredLibrary,
} from "./library-storage";

const valid = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  songs: demoSongs,
  repertoires: demoRepertoires,
};

const song = {
  id: "s1",
  title: "Teste",
  artist: "Artista",
  originalKey: "G",
  contentType: "original",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function withSongs(songs: unknown[], repertoires: unknown[] = []) {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, songs, repertoires };
}

describe("validação de dados persistidos", () => {
  it("aceita os dados de demonstração", () => {
    expect(parseLibraryDocument(valid).status).toBe("ok");
  });

  it.each([
    ["sem versão", { songs: [], repertoires: [] }],
    ["não objeto", [1, 2]],
    ["nulo", null],
    ["sem coleções", { schemaVersion: CURRENT_SCHEMA_VERSION }],
    ["tom inexistente", withSongs([{ ...song, originalKey: "H" }])],
    ["título vazio", withSongs([{ ...song, title: "  " }])],
    ["data inválida", withSongs([{ ...song, createdAt: "ontem" }])],
    ["campo desconhecido", withSongs([{ ...song, extra: true }])],
    ["cifra em link externo", withSongs([{ ...song, contentType: "external-link", sourceUrl: "https://a.com", chordPro: "[G]" }])],
    ["link externo sem URL", withSongs([{ ...song, contentType: "external-link" }])],
    ["URL perigosa", withSongs([{ ...song, contentType: "external-link", sourceUrl: "javascript:alert(1)" }])],
    ["sourceUrl em música própria", withSongs([{ ...song, sourceUrl: "https://a.com" }])],
    ["IDs repetidos", withSongs([song, song])],
  ])("rejeita documento com %s", (_name, document) => {
    expect(parseLibraryDocument(document).status).toBe("invalid");
  });

  it("rejeita repertório que aponta para música inexistente", () => {
    const document = withSongs(
      [song],
      [
        {
          id: "r1",
          name: "R",
          description: "",
          createdAt: song.createdAt,
          updatedAt: song.updatedAt,
          items: [{ id: "i1", songId: "fantasma", position: 1, transposeSemitones: 0 }],
        },
      ],
    );
    expect(parseLibraryDocument(document).status).toBe("invalid");
  });

  it("identifica dados de uma versão mais nova sem tentar interpretá-los", () => {
    expect(parseLibraryDocument({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }).status).toBe(
      "newer-version",
    );
  });

  it("aplica migrações de versões anteriores antes de validar", () => {
    const legacy = { schemaVersion: 0, musicas: demoSongs, repertoires: demoRepertoires };
    const result = parseLibraryDocument(legacy, {
      ...LIBRARY_MIGRATIONS,
      0: ({ musicas, ...rest }) => ({ ...rest, songs: musicas }),
    });
    expect(result.status).toBe("ok");
  });

  it("rejeita versão anterior sem migração registrada", () => {
    expect(parseLibraryDocument({ ...valid, schemaVersion: 0 }).status).toBe("invalid");
  });

  it("trata JSON malformado como documento inválido", () => {
    expect(parseLibraryDocument(parseJsonDocument("{ quebrado")).status).toBe("invalid");
  });
});

describe("leitura", () => {
  it("usa a chave versionada das instalações antigas", () => {
    expect(LIBRARY_STORAGE_KEY).toBe("repertorio.biblioteca.v1");
  });

  it("informa quando não há dados salvos", () => {
    expect(readStoredLibrary(() => createMemoryStorage())).toEqual({ status: "empty" });
  });

  it("informa indisponibilidade quando o acesso ao armazenamento falha", () => {
    expect(
      readStoredLibrary(() => {
        throw new Error("bloqueado");
      }),
    ).toEqual({ status: "unavailable" });
  });


});
