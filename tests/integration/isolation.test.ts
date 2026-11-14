import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createLibraryService } from "@/server/library/library-service";

import { clearDatabase, dropTestDatabase, hostedSong } from "./helpers";
import { latest } from "@/test/latest-revision";

const userA = createLibraryService("usuario-a");
const userB = createLibraryService("usuario-b");

beforeEach(clearDatabase);
afterAll(dropTestDatabase);

describe("isolamento entre usuários", () => {
  it("B não acessa a música de A", async () => {
    const song = await userA.songs.create(hostedSong);

    await expect(userB.songs.findById(song.id)).resolves.toBeNull();
    await expect(userB.songs.findByIds([song.id])).resolves.toEqual([]);
  });

  it("B não edita a música de A, e a resposta é igual à de um ID inexistente", async () => {
    const song = await userA.songs.create(hostedSong);

    await expect(latest(userB).songs.update(song.id, { ...hostedSong, title: "Invadida" })).rejects.toMatchObject({
      code: "song-not-found",
    });
    await expect(userA.songs.findById(song.id)).resolves.toMatchObject({ title: hostedSong.title });
  });

  it("B não exclui a música de A", async () => {
    const song = await userA.songs.create(hostedSong);

    await expect(latest(userB).songs.delete(song.id)).rejects.toMatchObject({ code: "song-not-found" });
    await expect(userA.songs.findById(song.id)).resolves.not.toBeNull();
  });

  it("B não adiciona a música de A ao próprio repertório", async () => {
    const song = await userA.songs.create(hostedSong);
    const repertoire = await userB.repertoires.create({ name: "De B", description: "" });

    await expect(latest(userB).repertoires.addSong(repertoire.id, song.id)).rejects.toMatchObject({
      code: "song-not-found",
    });
    await expect(userB.repertoires.findById(repertoire.id)).resolves.toMatchObject({ items: [] });
  });

  it("listagens não misturam usuários", async () => {
    await userA.songs.create({ ...hostedSong, title: "De A" });
    await userB.songs.create({ ...hostedSong, title: "De B" });
    await userA.repertoires.create({ name: "Rep A", description: "" });
    await userB.repertoires.create({ name: "Rep B", description: "" });

    expect((await userA.songs.list()).map((song) => song.title)).toEqual(["De A"]);
    expect((await userB.songs.list()).map((song) => song.title)).toEqual(["De B"]);
    expect((await userA.repertoires.list()).map((r) => r.name)).toEqual(["Rep A"]);
    expect((await userB.repertoires.list()).map((r) => r.name)).toEqual(["Rep B"]);
  });

  it("B não acessa nem altera o repertório de A em nenhuma operação", async () => {
    const song = await userA.songs.create(hostedSong);
    const created = await userA.repertoires.create({ name: "De A", description: "" });
    const repertoire = await latest(userA).repertoires.addSong(created.id, song.id);
    const itemId = repertoire.items[0].id;
    const notFound = { code: "repertoire-not-found" };

    await expect(userB.repertoires.findById(repertoire.id)).resolves.toBeNull();
    await expect(latest(userB).repertoires.update(repertoire.id, { name: "X", description: "" })).rejects.toMatchObject(notFound);
    await expect(latest(userB).repertoires.delete(repertoire.id)).rejects.toMatchObject(notFound);
    await expect(latest(userB).repertoires.addSong(repertoire.id, song.id)).rejects.toMatchObject(notFound);
    await expect(latest(userB).repertoires.removeItem(repertoire.id, itemId)).rejects.toMatchObject(notFound);
    await expect(latest(userB).repertoires.moveItem(repertoire.id, itemId, "down")).rejects.toMatchObject(notFound);
    await expect(latest(userB).repertoires.updateItem(repertoire.id, itemId, { notes: "X" })).rejects.toMatchObject(notFound);

    await expect(userA.repertoires.findById(repertoire.id)).resolves.toEqual(repertoire);
  });

  it("a verificação de uso considera somente os repertórios do proprietário", async () => {
    const song = await userA.songs.create(hostedSong);
    const repertoire = await userB.repertoires.create({ name: "De B", description: "" });
    await expect(latest(userB).repertoires.addSong(repertoire.id, song.id)).rejects.toBeDefined();

    await expect(latest(userA).songs.delete(song.id)).resolves.toBeUndefined();
  });
});
