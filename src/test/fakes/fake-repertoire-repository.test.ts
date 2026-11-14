import { beforeEach, describe, expect, it } from "vitest";

import { demoSongs } from "@/features/songs/data/demo-songs";

import { sortRepertoireItems } from "@/features/repertoires/services/repertoire-service";
import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import type { RepertoireRepository } from "@/features/repertoires/data/repertoire-repository";
import { createFakeRepertoireRepository } from "./fake-repertoire-repository";
import { createFakeSongRepository } from "./fake-song-repository";
import { createMemoryLibraryStore, type LibraryStore } from "./memory-library-store";
// Escritas destes testes usam a revisão atual; a concorrência tem testes próprios.
import { latestOf as L } from "@/test/latest-revision";

const seed = { songs: demoSongs, repertoires: demoRepertoires };
const ENSAIO = "rep-ensaio-acustico";

let store: LibraryStore;

let repository: RepertoireRepository;

beforeEach(() => {
  store = createMemoryLibraryStore(seed);
  repository = createFakeRepertoireRepository(store);
});

function reopen(): RepertoireRepository {
  return createFakeRepertoireRepository(
    store,
  );
}

async function songOrder(id: string): Promise<string[]> {
  const repertoire = await repository.findById(id);
  return sortRepertoireItems(repertoire?.items ?? []).map((item) => item.songId);
}

async function positions(id: string): Promise<number[]> {
  const repertoire = await repository.findById(id);
  return sortRepertoireItems(repertoire?.items ?? []).map((item) => item.position);
}

describe("criação e edição de repertório", () => {
  it("cria um repertório vazio e persiste", async () => {
    const created = await repository.create({ name: "Show", description: "" });

    expect(created.items).toEqual([]);
    await expect(reopen().findById(created.id)).resolves.toEqual(created);
  });

  it("altera nome e descrição preservando as músicas e createdAt", async () => {
    const before = await repository.findById(ENSAIO);

    const updated = await L(repository).update(ENSAIO, { name: "Novo nome", description: "Nova" });

    expect(updated).toMatchObject({ name: "Novo nome", description: "Nova" });
    expect(updated.items).toEqual(before?.items);
    expect(updated.createdAt).toBe(before?.createdAt);
    expect(updated.updatedAt).not.toBe(before?.updatedAt);
  });

  it("rejeita nome vazio", async () => {
    await expect(repository.create({ name: "  ", description: "" })).rejects.toMatchObject({
      code: "invalid-data",
    });
  });
});

describe("exclusão de repertório", () => {
  it("remove o repertório e mantém as músicas", async () => {
    await L(repository).delete(ENSAIO);

    await expect(reopen().findById(ENSAIO)).resolves.toBeNull();
    expect(store.read().songs).toHaveLength(demoSongs.length);
  });

  it("rejeita repertório inexistente", async () => {
    await expect(L(repository).delete("nao-existe")).rejects.toMatchObject({
      code: "repertoire-not-found",
    });
  });
});

describe("inclusão de música", () => {
  it("adiciona ao final com referência à música, sem copiar a cifra", async () => {
    const updated = await L(repository).addSong(ENSAIO, "song-caminhos");
    const item = updated.items.at(-1);

    expect(item).toMatchObject({ songId: "song-caminhos", position: 4, transposeSemitones: 0 });
    expect(JSON.stringify(item)).not.toContain("Hoje vou");
  });

  it("não permite repetir a música no mesmo repertório", async () => {
    await expect(L(repository).addSong(ENSAIO, "song-coracao-de-vento")).rejects.toMatchObject({
      code: "song-already-in-repertoire",
    });
  });

  it("rejeita música inexistente", async () => {
    await expect(L(repository).addSong(ENSAIO, "fantasma")).rejects.toMatchObject({
      code: "song-not-found",
    });
  });

  it("permite a mesma música em repertórios com ordens próprias", async () => {
    const other = await repository.create({ name: "Outro", description: "" });
    await L(repository).addSong(other.id, "song-estrada-de-terra");

    await expect(songOrder(other.id)).resolves.toEqual(["song-estrada-de-terra"]);
    await expect(songOrder(ENSAIO)).resolves.toContain("song-estrada-de-terra");
  });
});

describe("remoção de música", () => {
  it("remove o item e normaliza as posições", async () => {
    await L(repository).removeItem(ENSAIO, "item-ensaio-mare");

    await expect(songOrder(ENSAIO)).resolves.toEqual([
      "song-estrada-de-terra",
      "song-coracao-de-vento",
    ]);
    await expect(positions(ENSAIO)).resolves.toEqual([1, 2]);
  });
});

describe("reordenação", () => {
  it("move para cima e para baixo, mantendo posições sequenciais", async () => {
    await L(repository).moveItem(ENSAIO, "item-ensaio-coracao", "up");
    await expect(songOrder(ENSAIO)).resolves.toEqual([
      "song-estrada-de-terra",
      "song-coracao-de-vento",
      "song-mare-de-setembro",
    ]);
    await expect(positions(ENSAIO)).resolves.toEqual([1, 2, 3]);

    await L(repository).moveItem(ENSAIO, "item-ensaio-estrada", "down");
    await expect(songOrder(ENSAIO)).resolves.toEqual([
      "song-coracao-de-vento",
      "song-estrada-de-terra",
      "song-mare-de-setembro",
    ]);
  });

  it("não sai dos limites da lista", async () => {
    await L(repository).moveItem(ENSAIO, "item-ensaio-estrada", "up");
    await expect(songOrder(ENSAIO)).resolves.toEqual([
      "song-estrada-de-terra",
      "song-mare-de-setembro",
      "song-coracao-de-vento",
    ]);
  });

  it("persiste a nova ordem para a próxima sessão", async () => {
    await L(repository).moveItem(ENSAIO, "item-ensaio-coracao", "up");
    const reopened = await reopen().findById(ENSAIO);
    expect(sortRepertoireItems(reopened?.items ?? []).map((i) => i.id)).toEqual([
      "item-ensaio-estrada",
      "item-ensaio-coracao",
      "item-ensaio-mare",
    ]);
  });

  it("preserva notas e transposição de cada item", async () => {
    await L(repository).moveItem(ENSAIO, "item-ensaio-coracao", "up");
    const repertoire = await repository.findById(ENSAIO);
    const item = repertoire?.items.find((candidate) => candidate.id === "item-ensaio-coracao");
    expect(item?.transposeSemitones).toBe(2);
  });
});

describe("referências às músicas", () => {
  it("reflete a edição da música sem duplicar seus dados", async () => {
    await L(createFakeSongRepository(store)).update("song-caminhos", {
      title: "Título Novo",
      artist: "Banda Exemplo",
      originalKey: "G",
      contentType: "original",
      chordPro: "[G]Letra revisada",
    });

    const raw = JSON.stringify(store.read());
    expect(raw.match(/Título Novo/g)).toHaveLength(1);
  });
});
