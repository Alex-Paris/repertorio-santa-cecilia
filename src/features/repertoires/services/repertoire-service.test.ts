import { describe, expect, it } from "vitest";

import { createInMemorySongRepository } from "@/features/songs/data/song-repository";
import type { Song } from "@/features/songs/domain/song";

import { createInMemoryRepertoireRepository } from "../data/repertoire-repository";
import { createRepertoireItem, type Repertoire } from "../domain/repertoire";
import {
  buildRepertoireEntries,
  getRepertoireDetail,
  sortRepertoireItems,
} from "./repertoire-service";

const song: Song = {
  id: "song-1",
  title: "Teste",
  artist: "Artista",
  originalKey: "G",
  contentType: "original",
  revision: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const items = [
  createRepertoireItem({ id: "c", songId: "song-1", position: 30 }),
  createRepertoireItem({ id: "a", songId: "song-1", position: 10, transposeSemitones: 2 }),
  createRepertoireItem({ id: "b", songId: "ausente", position: 20 }),
];

const repertoire: Repertoire = {
  revision: 1,
  id: "rep-1",
  name: "Repertório",
  description: "Descrição",
  items,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const repositories = {
  repertoires: createInMemoryRepertoireRepository([repertoire]),
  songs: createInMemorySongRepository([song]),
};

describe("createRepertoireItem", () => {
  it("usa 0 como transposição padrão", () => {
    expect(createRepertoireItem({ id: "x", songId: "y", position: 1 }).transposeSemitones).toBe(0);
  });
});

describe("sortRepertoireItems", () => {
  it("ordena por position sem alterar o array recebido", () => {
    const received = [...items];
    expect(sortRepertoireItems(items).map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(items).toEqual(received);
  });
});

describe("buildRepertoireEntries", () => {
  it("calcula o tom preferido apenas quando há transposição", () => {
    const entries = buildRepertoireEntries(items, [song]);
    expect(entries.map((entry) => entry.preferredKey)).toEqual(["A", null, null]);
  });

  it("marca como nula a música que não existe mais", () => {
    expect(buildRepertoireEntries(items, [song])[1].song).toBeNull();
  });
});

describe("getRepertoireDetail", () => {
  it("retorna o repertório com as músicas em ordem", async () => {
    const detail = await getRepertoireDetail("rep-1", repositories);
    expect(detail?.entries.map((entry) => entry.item.id)).toEqual(["a", "b", "c"]);
  });

  it("retorna null para ID inexistente", async () => {
    await expect(getRepertoireDetail("nao-existe", repositories)).resolves.toBeNull();
  });
});
