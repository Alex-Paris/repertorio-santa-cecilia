import { describe, expect, it } from "vitest";

import type { Song } from "../domain/song";
import { filterSongs, sortSongsByTitle } from "./song-filters";

const base = {
  originalKey: "G",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  revision: 1,
} as const;

const songs: Song[] = [
  { ...base, id: "1", title: "Coração de Vento", artist: "Banda Exemplo", contentType: "original" },
  { ...base, id: "2", title: "Caminhos", artist: "Duo Fictício", contentType: "authorized" },
  {
    ...base,
    id: "3",
    title: "Noite no Cais",
    artist: "Banda Exemplo",
    contentType: "external-link",
    sourceUrl: "https://example.com/noite",
  },
];

function ids(result: Song[]): string[] {
  return result.map((song) => song.id);
}

describe("filterSongs", () => {
  it("retorna todas as músicas sem busca e sem filtro", () => {
    expect(ids(filterSongs(songs, { query: "", contentType: "all" }))).toEqual(["1", "2", "3"]);
  });

  it("busca pelo título", () => {
    expect(ids(filterSongs(songs, { query: "cais", contentType: "all" }))).toEqual(["3"]);
  });

  it("busca pelo artista", () => {
    expect(ids(filterSongs(songs, { query: "banda", contentType: "all" }))).toEqual(["1", "3"]);
  });

  it("ignora acentos, maiúsculas e espaços nas pontas", () => {
    expect(ids(filterSongs(songs, { query: "  CORACAO ", contentType: "all" }))).toEqual(["1"]);
    expect(ids(filterSongs(songs, { query: "ficticio", contentType: "all" }))).toEqual(["2"]);
  });

  it("filtra por tipo de conteúdo", () => {
    expect(ids(filterSongs(songs, { query: "", contentType: "external-link" }))).toEqual(["3"]);
  });

  it("combina busca e filtro", () => {
    expect(ids(filterSongs(songs, { query: "banda", contentType: "original" }))).toEqual(["1"]);
  });

  it("retorna lista vazia quando nada corresponde", () => {
    expect(filterSongs(songs, { query: "inexistente", contentType: "all" })).toEqual([]);
  });
});

describe("sortSongsByTitle", () => {
  it("ordena alfabeticamente sem alterar a lista original", () => {
    const original = [...songs];
    expect(ids(sortSongsByTitle(songs))).toEqual(["2", "1", "3"]);
    expect(songs).toEqual(original);
  });
});
