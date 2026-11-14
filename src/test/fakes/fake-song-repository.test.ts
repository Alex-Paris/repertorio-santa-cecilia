import { beforeEach, describe, expect, it, vi } from "vitest";

import { SongInUseError } from "@/features/library/domain/library-errors";
import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";

import type { SongInput } from "@/features/songs/domain/song";
import { demoSongs } from "@/features/songs/data/demo-songs";
import type { SongRepository } from "@/features/songs/data/song-repository";
import { createFakeRepertoireRepository } from "./fake-repertoire-repository";
import { createFakeSongRepository } from "./fake-song-repository";
import { createMemoryLibraryStore, type LibraryStore } from "./memory-library-store";
// Escritas destes testes usam a revisão atual; a concorrência tem testes próprios.
import { latestOf as L } from "@/test/latest-revision";

const hostedInput: SongInput = {
  title: "Nova Canção",
  artist: "Autora",
  originalKey: "A",
  contentType: "original",
  chordPro: "[A]Primeira linha\n\n[D]Segunda linha",
};

const externalInput: SongInput = {
  title: "Link",
  artist: "Autora",
  originalKey: "E",
  contentType: "external-link",
  sourceUrl: "https://example.com/cifra",
};

const seed = { songs: demoSongs, repertoires: demoRepertoires };

let store: LibraryStore;

let repository: SongRepository;

beforeEach(() => {
  store = createMemoryLibraryStore(seed);
  repository = createFakeSongRepository(store);
});

function reopen(): SongRepository {
  return createFakeSongRepository(store);
}

describe("criação de música", () => {
  it("gera ID e datas, e persiste para a próxima sessão", async () => {
    const created = await repository.create(hostedInput);

    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBe(created.updatedAt);
    await expect(reopen().findById(created.id)).resolves.toEqual(created);
  });

  it("preserva o texto da cifra exatamente como foi digitado", async () => {
    const { id } = await repository.create(hostedInput);
    const reopened = await reopen().findById(id);
    expect(reopened?.chordPro).toBe(hostedInput.chordPro);
  });

  it("gera IDs diferentes para músicas iguais", async () => {
    const [first, second] = await Promise.all([
      repository.create(hostedInput),
      repository.create(hostedInput),
    ]);
    expect(first.id).not.toBe(second.id);
  });

  it("rejeita dados inválidos sem gravar", async () => {
    await expect(repository.create({ ...hostedInput, title: "   " })).rejects.toMatchObject({
      code: "invalid-data",
    });
    await expect(repository.list()).resolves.toHaveLength(demoSongs.length);
  });
});

describe("edição de música", () => {
  it("preserva createdAt e atualiza updatedAt", async () => {
    vi.useFakeTimers({ now: new Date("2026-06-01T10:00:00.000Z") });
    const created = await repository.create(hostedInput);
    vi.setSystemTime(new Date("2026-06-02T10:00:00.000Z"));

    const updated = await L(repository).update(created.id, { ...hostedInput, title: "Outro" });
    vi.useRealTimers();

    expect(updated.title).toBe("Outro");
    expect(updated.createdAt).toBe("2026-06-01T10:00:00.000Z");
    expect(updated.updatedAt).toBe("2026-06-02T10:00:00.000Z");
  });

  it("não mantém campos do tipo anterior ao trocar o tipo de conteúdo", async () => {
    const created = await repository.create(hostedInput);

    const external = await L(repository).update(created.id, externalInput);
    expect(external).not.toHaveProperty("chordPro");
    expect(external.sourceUrl).toBe(externalInput.sourceUrl);

    const hosted = await L(repository).update(created.id, hostedInput);
    expect(hosted).not.toHaveProperty("sourceUrl");
  });

  it("rejeita música inexistente", async () => {
    await expect(L(repository).update("nao-existe", hostedInput)).rejects.toMatchObject({
      code: "song-not-found",
    });
  });
});

describe("exclusão de música", () => {
  it("remove a música sem recriá-la ao reabrir", async () => {
    const { id } = await repository.create(hostedInput);

    await L(repository).delete(id);

    await expect(reopen().findById(id)).resolves.toBeNull();
  });

  it("bloqueia a exclusão de música em uso e informa os repertórios", async () => {
    const error = await L(repository).delete("song-coracao-de-vento").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SongInUseError);
    expect((error as SongInUseError).repertoires.map((r) => r.name)).toEqual([
      "Sarau de Domingo",
      "Ensaio Acústico",
    ]);
    expect((error as SongInUseError).message).toContain("Sarau de Domingo");
    await expect(repository.findById("song-coracao-de-vento")).resolves.not.toBeNull();
  });

  it("permite excluir depois de remover a música dos repertórios", async () => {
    const repertoires = createFakeRepertoireRepository(store);
    await L(repertoires).removeItem("rep-sarau-de-domingo", "item-sarau-caminhos");

    await L(repository).delete("song-caminhos");

    await expect(repository.findById("song-caminhos")).resolves.toBeNull();
  });
});

describe("leitura", () => {
  it("entrega cópias: alterar o resultado não afeta os dados guardados", async () => {
    const songs = await repository.list();
    songs[0].title = "Alterado";

    await expect(repository.findById(songs[0].id)).resolves.toMatchObject({
      title: demoSongs[0].title,
    });
  });

});
