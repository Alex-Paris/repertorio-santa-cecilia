import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { LibraryError } from "@/features/library/domain/library-errors";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { SongModel } from "@/server/database/models/song-model";
import { createLibraryService } from "@/server/library/library-service";

import { clearDatabase, dropTestDatabase, hostedSong } from "./helpers";
import { latest } from "@/test/latest-revision";

// Testes de outras regras: cada escrita usa a revisão atual. A concorrência de versões
// tem testes próprios em `revisions.test.ts`.
const { songs, repertoires } = latest(createLibraryService("usuario-a"));

beforeEach(clearDatabase);
afterAll(dropTestDatabase);

async function outcome(operation: Promise<unknown>): Promise<string> {
  try {
    await operation;
    return "ok";
  } catch (error) {
    if (error instanceof LibraryError) {
      return error.code;
    }
    throw error;
  }
}

describe("transações", () => {
  it("o MongoDB de teste é um replica set com suporte a transações", async () => {
    const song = await songs.create(hostedSong);
    await expect(songs.delete(song.id)).resolves.toBeUndefined();
  });

  it("uma falha de domínio desfaz a transação inteira", async () => {
    const repertoire = await repertoires.create({ name: "R", description: "" });
    const song = await songs.create(hostedSong);
    await repertoires.addSong(repertoire.id, song.id);
    const before = await RepertoireModel.findOne({ id: repertoire.id }).lean();

    await expect(repertoires.addSong(repertoire.id, song.id)).rejects.toBeDefined();

    expect(await RepertoireModel.findOne({ id: repertoire.id }).lean()).toEqual(before);
  });
});

describe("corrida entre incluir em repertório e excluir a música", () => {
  it("nunca deixa um repertório apontando para música inexistente", async () => {
    const outcomes = new Set<string>();

    for (let round = 0; round < 25; round++) {
      const song = await songs.create({ ...hostedSong, title: `Música ${round}` });
      const repertoire = await repertoires.create({ name: `R${round}`, description: "" });

      const [added, deleted] = await Promise.all([
        outcome(repertoires.addSong(repertoire.id, song.id)),
        outcome(songs.delete(song.id)),
      ]);

      outcomes.add(`${added}/${deleted}`);

      const stored = await RepertoireModel.findOne({ id: repertoire.id }).lean();
      const exists = await SongModel.exists({ id: song.id });

      if (stored?.items.length) {
        expect(exists).not.toBeNull();
      }
      expect(["ok/song-in-use", "song-not-found/ok"]).toContain(`${added}/${deleted}`);
    }

    expect(outcomes.size).toBeGreaterThan(0);
  });
});

// Desde a Etapa 2D.1, escritas paralelas com a mesma revisão não se combinam: uma vence e as
// outras recebem conflito. O que estes testes garantem é que nada se perde em silêncio.
describe("escritas simultâneas no mesmo repertório", () => {
  const raw = createLibraryService("usuario-a").repertoires;

  async function revisionOf(id: string): Promise<number> {
    return (await raw.findById(id))?.revision ?? 0;
  }

  it("adições paralelas da mesma música geram apenas um item", async () => {
    const song = await songs.create(hostedSong);
    const repertoire = await repertoires.create({ name: "R", description: "" });

    const results = await Promise.all(
      Array.from({ length: 6 }, () => outcome(raw.addSong(repertoire.id, song.id, 1))),
    );

    expect(results.filter((result) => result === "ok")).toHaveLength(1);
    expect(results.filter((result) => result === "revision-conflict")).toHaveLength(5);
    await expect(repertoires.findById(repertoire.id)).resolves.toMatchObject({ items: [{ position: 1 }] });
  });

  it("adições paralelas de músicas diferentes: cada uma é aplicada ou recusada, nunca perdida", async () => {
    const repertoire = await repertoires.create({ name: "R", description: "" });
    const created = await Promise.all(
      Array.from({ length: 6 }, (_, index) => songs.create({ ...hostedSong, title: `M${index}` })),
    );

    const results = await Promise.all(created.map((song) => outcome(raw.addSong(repertoire.id, song.id, 1))));

    expect(results.filter((result) => result === "ok")).toHaveLength(1);
    expect(results.every((result) => result === "ok" || result === "revision-conflict")).toBe(true);
    expect((await repertoires.findById(repertoire.id))?.items).toHaveLength(1);

    // Refeitas sobre a revisão atual, as recusadas entram.
    for (const [index, song] of created.entries()) {
      if (results[index] !== "ok") {
        await raw.addSong(repertoire.id, song.id, await revisionOf(repertoire.id));
      }
    }
    const stored = await repertoires.findById(repertoire.id);
    expect(stored?.items.map((item) => item.position).sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("alterações paralelas em itens diferentes: a vencedora fica, as outras não sobrescrevem", async () => {
    const created = await Promise.all(
      Array.from({ length: 4 }, (_, index) => songs.create({ ...hostedSong, title: `M${index}` })),
    );
    const repertoire = await repertoires.create({ name: "R", description: "" });
    for (const song of created) {
      await repertoires.addSong(repertoire.id, song.id);
    }
    const { items, revision } = (await raw.findById(repertoire.id))!;

    const results = await Promise.all(
      items.map((item, index) =>
        outcome(raw.updateItem(repertoire.id, item.id, { notes: `Nota ${index}`, transposeSemitones: index + 1 }, revision)),
      ),
    );

    expect(results.filter((result) => result === "ok")).toHaveLength(1);
    const stored = await repertoires.findById(repertoire.id);
    items.forEach((item, index) => {
      const saved = stored?.items.find((candidate) => candidate.id === item.id);
      if (results[index] === "ok") {
        expect(saved).toMatchObject({ notes: `Nota ${index}`, transposeSemitones: index + 1 });
      } else {
        expect(saved).toMatchObject({ transposeSemitones: 0 });
        expect(saved?.notes).toBeUndefined();
      }
    });
    expect(stored?.revision).toBe(revision + 1);
  });

  it("movimentos paralelos mantêm posições válidas e sem repetição", async () => {
    const created = await Promise.all(
      Array.from({ length: 5 }, (_, index) => songs.create({ ...hostedSong, title: `M${index}` })),
    );
    const repertoire = await repertoires.create({ name: "R", description: "" });
    for (const song of created) {
      await repertoires.addSong(repertoire.id, song.id);
    }
    const { items, revision } = (await raw.findById(repertoire.id))!;

    const results = await Promise.all(
      items.map((item) => outcome(raw.moveItem(repertoire.id, item.id, "down", revision))),
    );

    expect(results.filter((result) => result === "ok")).toHaveLength(1);
    const stored = await repertoires.findById(repertoire.id);
    expect(stored?.items.map((item) => item.position).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(stored?.items.map((item) => item.id)).size).toBe(5);
  });
});
