import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { LibraryError, SongInUseError } from "@/features/library/domain/library-errors";
import { connectToMongoose } from "@/server/database/mongoose-connection";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { SongModel } from "@/server/database/models/song-model";
import { createLibraryService } from "@/server/library/library-service";
import { createMongoSongRepository } from "@/server/repositories/mongo-song-repository";

import { clearDatabase, dropTestDatabase, externalSong, hostedSong } from "./helpers";
import { latest } from "@/test/latest-revision";

const OWNER = "usuario-a";
// Testes de outras regras: cada escrita usa a revisão atual. A concorrência de versões
// tem testes próprios em `revisions.test.ts`.
const { songs, repertoires } = latest(createLibraryService(OWNER));

beforeEach(clearDatabase);
afterAll(dropTestDatabase);

async function repertoireWithSongs(count: number) {
  const repertoire = await repertoires.create({ name: "Show", description: "" });
  let current = repertoire;
  const created = [];
  for (let index = 0; index < count; index++) {
    const song = await songs.create({ ...hostedSong, title: `Música ${index}` });
    created.push(song);
    current = await repertoires.addSong(repertoire.id, song.id);
  }
  return { repertoire: current, songs: created };
}

describe("músicas", () => {
  it("cria e lê uma música com o modelo de domínio", async () => {
    const created = await songs.create(hostedSong);

    expect(created.id).toBeTruthy();
    expect(created.chordPro).toBe(hostedSong.contentType === "external-link" ? "" : hostedSong.chordPro);
    expect(created).not.toHaveProperty("ownerId");
    expect(created).not.toHaveProperty("_id");
    expect(created).not.toHaveProperty("referenceVersion");
    await expect(songs.findById(created.id)).resolves.toEqual(created);
  });

  it("grava o proprietário e usa um ID público independente do _id", async () => {
    const created = await songs.create(hostedSong);
    const document = await SongModel.findOne({ id: created.id }).lean();

    expect(document?.ownerId).toBe(OWNER);
    expect(String(document?._id)).not.toBe(created.id);
  });

  it("lista por título e busca vários IDs na ordem pedida", async () => {
    const b = await songs.create({ ...hostedSong, title: "B" });
    const a = await songs.create({ ...hostedSong, title: "A" });

    expect((await songs.list()).map((song) => song.title)).toEqual(["A", "B"]);
    expect((await songs.findByIds([b.id, "ausente", a.id])).map((song) => song.id)).toEqual([b.id, a.id]);
  });

  it("atualiza, preservando createdAt e renovando updatedAt", async () => {
    vi.useFakeTimers({ now: new Date("2026-06-01T10:00:00.000Z"), toFake: ["Date"] });
    const created = await songs.create(hostedSong);
    vi.setSystemTime(new Date("2026-06-02T10:00:00.000Z"));

    const updated = await songs.update(created.id, { ...hostedSong, title: "Novo" });
    vi.useRealTimers();

    expect(updated.title).toBe("Novo");
    expect(updated.createdAt).toBe("2026-06-01T10:00:00.000Z");
    expect(updated.updatedAt).toBe("2026-06-02T10:00:00.000Z");
  });

  it("não deixa campos do tipo anterior ao trocar o tipo de conteúdo", async () => {
    const created = await songs.create(hostedSong);

    const external = await songs.update(created.id, externalSong);
    expect(external).not.toHaveProperty("chordPro");
    expect((await SongModel.findOne({ id: created.id }).lean())?.chordPro).toBeUndefined();

    const hosted = await songs.update(created.id, hostedSong);
    expect(hosted).not.toHaveProperty("sourceUrl");
    expect((await SongModel.findOne({ id: created.id }).lean())?.sourceUrl).toBeUndefined();
  });

  it("exclui uma música sem uso", async () => {
    const created = await songs.create(hostedSong);

    await songs.delete(created.id);

    await expect(songs.findById(created.id)).resolves.toBeNull();
  });

  it("aplica as validações do domínio", async () => {
    await expect(songs.create({ ...hostedSong, title: "  " })).rejects.toMatchObject({ code: "invalid-data" });
    await expect(
      songs.create({ ...externalSong, sourceUrl: "javascript:alert(1)" } as never),
    ).rejects.toMatchObject({ code: "invalid-data" });
    await expect(songs.create({ ...hostedSong, title: "x".repeat(301) })).rejects.toMatchObject({
      code: "invalid-data",
    });
  });

  it("trata IDs inválidos ou inexistentes como não encontrados", async () => {
    await expect(songs.findById("x".repeat(129))).resolves.toBeNull();
    await expect(songs.findById({ $ne: null } as never)).resolves.toBeNull();
    await expect(songs.update("ausente", hostedSong)).rejects.toMatchObject({ code: "song-not-found" });
    await expect(songs.delete("ausente")).rejects.toMatchObject({ code: "song-not-found" });
  });
});

describe("repertórios", () => {
  it("cria, lê, altera e exclui", async () => {
    const created = await repertoires.create({ name: "Sarau", description: "" });
    expect(created.items).toEqual([]);
    expect(created).not.toHaveProperty("ownerId");

    const updated = await repertoires.update(created.id, { name: "Sarau 2", description: "Novo" });
    expect(updated).toMatchObject({ name: "Sarau 2", description: "Novo", createdAt: created.createdAt });
    await expect(repertoires.findById(created.id)).resolves.toEqual(updated);

    await repertoires.delete(created.id);
    await expect(repertoires.findById(created.id)).resolves.toBeNull();
  });

  it("lista pelos alterados mais recentemente", async () => {
    const first = await repertoires.create({ name: "Primeiro", description: "" });
    await repertoires.create({ name: "Segundo", description: "" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await repertoires.update(first.id, { name: "Primeiro", description: "alterado" });

    expect((await repertoires.list()).map((r) => r.name)).toEqual(["Primeiro", "Segundo"]);
  });

  it("adiciona músicas guardando só a referência", async () => {
    const { repertoire, songs: [song] } = await repertoireWithSongs(1);

    expect(repertoire.items[0]).toMatchObject({ songId: song.id, position: 1, transposeSemitones: 0 });
    const stored = await RepertoireModel.findOne({ id: repertoire.id }).lean();
    expect(JSON.stringify(stored)).not.toContain("Hoje vou");
  });

  it("rejeita música repetida e referências inválidas", async () => {
    const { repertoire, songs: [song] } = await repertoireWithSongs(1);

    await expect(repertoires.addSong(repertoire.id, song.id)).rejects.toMatchObject({
      code: "song-already-in-repertoire",
    });
    await expect(repertoires.addSong(repertoire.id, "ausente")).rejects.toMatchObject({ code: "song-not-found" });
    await expect(repertoires.addSong("ausente", song.id)).rejects.toMatchObject({ code: "repertoire-not-found" });
    await expect(repertoires.addSong(repertoire.id, { $ne: null } as never)).rejects.toMatchObject({
      code: "song-not-found",
    });
  });

  it("reordena mantendo posições sequenciais e persiste", async () => {
    const { repertoire } = await repertoireWithSongs(3);
    const [first, second, third] = repertoire.items;

    const moved = await repertoires.moveItem(repertoire.id, third.id, "up");

    const order = [...moved.items].sort((a, b) => a.position - b.position);
    expect(order.map((item) => item.id)).toEqual([first.id, third.id, second.id]);
    expect(order.map((item) => item.position)).toEqual([1, 2, 3]);
    await expect(repertoires.findById(repertoire.id)).resolves.toEqual(moved);
  });

  it("remove item e normaliza posições", async () => {
    const { repertoire } = await repertoireWithSongs(3);

    const updated = await repertoires.removeItem(repertoire.id, repertoire.items[0].id);

    expect(updated.items.map((item) => item.position)).toEqual([1, 2]);
    await expect(repertoires.removeItem(repertoire.id, "ausente")).rejects.toMatchObject({
      code: "repertoire-item-not-found",
    });
  });

  it("altera tom e anotações apenas do item indicado", async () => {
    const { repertoire } = await repertoireWithSongs(2);
    const [target, other] = repertoire.items;

    await repertoires.updateItem(repertoire.id, target.id, { transposeSemitones: -3 });
    const updated = await repertoires.updateItem(repertoire.id, target.id, { notes: "Violão sozinho" });

    expect(updated.items.find((item) => item.id === target.id)).toMatchObject({
      transposeSemitones: -3,
      notes: "Violão sozinho",
    });
    expect(updated.items.find((item) => item.id === other.id)).toEqual(other);

    const cleared = await repertoires.updateItem(repertoire.id, target.id, { notes: "" });
    expect(cleared.items.find((item) => item.id === target.id)).not.toHaveProperty("notes");
  });

  it("valida os limites de tom e anotações", async () => {
    const { repertoire } = await repertoireWithSongs(1);
    const [item] = repertoire.items;

    await expect(repertoires.updateItem(repertoire.id, item.id, { transposeSemitones: 12 })).rejects.toMatchObject({
      code: "invalid-data",
    });
    await expect(
      repertoires.updateItem(repertoire.id, item.id, { notes: "x".repeat(501) }),
    ).rejects.toMatchObject({ code: "invalid-data" });
  });

  it("não aceita tom em música com link externo", async () => {
    const song = await songs.create(externalSong);
    const repertoire = await repertoires.create({ name: "R", description: "" });
    const { items } = await repertoires.addSong(repertoire.id, song.id);

    await expect(
      repertoires.updateItem(repertoire.id, items[0].id, { transposeSemitones: 2 }),
    ).rejects.toMatchObject({ code: "invalid-data" });
  });
});

describe("integridade", () => {
  it("bloqueia a exclusão de música em uso e informa os repertórios", async () => {
    const { repertoire, songs: [song] } = await repertoireWithSongs(1);

    const error = await songs.delete(song.id).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SongInUseError);
    expect((error as SongInUseError).repertoires).toEqual([{ id: repertoire.id, name: "Show" }]);
    await expect(songs.findById(song.id)).resolves.not.toBeNull();
  });

  it("permite excluir depois de remover dos repertórios", async () => {
    const { repertoire, songs: [song] } = await repertoireWithSongs(1);

    await repertoires.removeItem(repertoire.id, repertoire.items[0].id);
    await songs.delete(song.id);

    await expect(songs.findById(song.id)).resolves.toBeNull();
  });
});

describe("índices e IDs duplicados", () => {
  const document = {
    id: "id-fixo",
    title: "T",
    artist: "A",
    originalKey: "C" as const,
    contentType: "original" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("cria somente os índices documentados", async () => {
    await connectToMongoose();
    const names = (indexes: { key: Record<string, unknown> }[]) => indexes.map((index) => JSON.stringify(index.key)).sort();

    expect(names(await SongModel.collection.indexes())).toEqual(
      ['{"_id":1}', '{"ownerId":1,"id":1}', '{"ownerId":1,"title":1}'].sort(),
    );
    expect(names(await RepertoireModel.collection.indexes())).toEqual(
      ['{"_id":1}', '{"ownerId":1,"id":1}', '{"ownerId":1,"updatedAt":-1}'].sort(),
    );
  });

  it("rejeita ID duplicado para o mesmo usuário", async () => {
    await SongModel.create({ ...document, ownerId: OWNER });

    await expect(SongModel.create({ ...document, ownerId: OWNER })).rejects.toMatchObject({ code: 11000 });
  });

  it("permite o mesmo ID para usuários diferentes", async () => {
    await SongModel.create({ ...document, ownerId: "usuario-1" });

    await expect(SongModel.create({ ...document, ownerId: "usuario-2" })).resolves.toBeDefined();
  });

  it("traduz a colisão de ID em conflito de domínio", async () => {
    const repository = createMongoSongRepository({ ownerId: OWNER });
    const spy = vi.spyOn(crypto, "randomUUID").mockReturnValue("0-0-0-0-0");

    await repository.create(hostedSong);
    const error = await repository.create(hostedSong).catch((caught: unknown) => caught);
    spy.mockRestore();

    expect(error).toBeInstanceOf(LibraryError);
    expect(error).toMatchObject({ code: "conflict" });
  });
});
