import { beforeEach, describe, expect, it, vi } from "vitest";

import { SongInUseError } from "@/features/library/domain/library-errors";
import type { RepertoireRepository } from "@/features/repertoires/data/repertoire-repository";
import type { SongRepository } from "@/features/songs/data/song-repository";
import type { SongInput } from "@/features/songs/domain/song";
import { latest, type LatestRevisionRepositories } from "@/test/latest-revision";

export interface RepositoryPair {
  songs: SongRepository;
  repertoires: RepertoireRepository;
}

const hosted: SongInput = {
  title: "Caminhos",
  artist: "Banda Exemplo",
  originalKey: "G",
  contentType: "original",
  chordPro: "[G]Hoje vou se[D]guir",
};

const external: SongInput = {
  title: "Noite no Cais",
  artist: "Trio",
  originalKey: "Bb",
  contentType: "external-link",
  sourceUrl: "https://example.com/cifra",
};

/** Regras que toda implementação dos contratos precisa cumprir de forma idêntica. */
export function describeRepositoryContract(
  name: string,
  createRepositories: () => Promise<RepositoryPair>,
): void {
  describe(`contrato dos repositórios: ${name}`, () => {
    let raw: RepositoryPair;
    // As regras gerais usam sempre a revisão atual; o controle de versão tem seção própria.
    let songs: LatestRevisionRepositories["songs"];
    let repertoires: LatestRevisionRepositories["repertoires"];

    beforeEach(async () => {
      raw = await createRepositories();
      ({ songs, repertoires } = latest(raw));
    });

    async function repertoireWith(count: number) {
      const created = await repertoires.create({ name: "Show", description: "" });
      for (let index = 0; index < count; index++) {
        const song = await songs.create({ ...hosted, title: `Música ${index}` });
        await repertoires.addSong(created.id, song.id);
      }
      const repertoire = await repertoires.findById(created.id);
      if (!repertoire) {
        throw new Error("repertório ausente");
      }
      return repertoire;
    }

    function ordered<T extends { position: number }>(items: readonly T[]): T[] {
      return [...items].sort((a, b) => a.position - b.position);
    }

    describe("músicas", () => {
      it("cria e reabre a mesma música", async () => {
        const created = await songs.create(hosted);

        expect(created.createdAt).toBe(created.updatedAt);
        await expect(songs.findById(created.id)).resolves.toEqual(created);
      });

      it("preserva o texto da cifra como foi digitado", async () => {
        const chordPro = "  {title: X}\n\n[G]Letra   com  espaços\n";
        const created = await songs.create({ ...hosted, chordPro } as SongInput);
        expect(created.chordPro).toBe(chordPro);
      });

      it("busca vários IDs na ordem pedida, ignorando os ausentes", async () => {
        const first = await songs.create({ ...hosted, title: "B" });
        const second = await songs.create({ ...hosted, title: "A" });

        const found = await songs.findByIds([first.id, "ausente", second.id]);

        expect(found.map((song) => song.id)).toEqual([first.id, second.id]);
      });

      it("atualiza preservando createdAt e removendo campos do tipo anterior", async () => {
        const created = await songs.create(hosted);

        const updated = await songs.update(created.id, external);

        expect(updated.createdAt).toBe(created.createdAt);
        expect(updated).not.toHaveProperty("chordPro");
        expect(updated.sourceUrl).toBe("https://example.com/cifra");
      });

      it("retorna null para música inexistente", async () => {
        await expect(songs.findById("ausente")).resolves.toBeNull();
      });

      it("rejeita atualizar ou excluir música inexistente", async () => {
        await expect(songs.update("ausente", hosted)).rejects.toMatchObject({ code: "song-not-found" });
        await expect(songs.delete("ausente")).rejects.toMatchObject({ code: "song-not-found" });
      });

      it("rejeita dados inválidos", async () => {
        await expect(songs.create({ ...hosted, title: "  " })).rejects.toMatchObject({ code: "invalid-data" });
      });

      it("bloqueia a exclusão de música em uso", async () => {
        const repertoire = await repertoireWith(1);

        const error = await songs.delete(repertoire.items[0].songId).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(SongInUseError);
        expect((error as SongInUseError).repertoires).toEqual([{ id: repertoire.id, name: "Show" }]);
      });

      it("exclui música sem uso", async () => {
        const created = await songs.create(hosted);

        await songs.delete(created.id);

        await expect(songs.findById(created.id)).resolves.toBeNull();
      });
    });

    describe("repertórios", () => {
      it("cria vazio, altera e exclui", async () => {
        const created = await repertoires.create({ name: "R", description: "" });
        expect(created.items).toEqual([]);

        const updated = await repertoires.update(created.id, { name: "R2", description: "Nova" });
        expect(updated).toMatchObject({ name: "R2", description: "Nova", createdAt: created.createdAt });

        await repertoires.delete(created.id);
        await expect(repertoires.findById(created.id)).resolves.toBeNull();
      });

      it("rejeita operar em repertório inexistente", async () => {
        const notFound = { code: "repertoire-not-found" };
        const song = await songs.create(hosted);

        await expect(repertoires.update("ausente", { name: "X", description: "" })).rejects.toMatchObject(notFound);
        await expect(repertoires.delete("ausente")).rejects.toMatchObject(notFound);
        await expect(repertoires.addSong("ausente", song.id)).rejects.toMatchObject(notFound);
        await expect(repertoires.removeItem("ausente", "i")).rejects.toMatchObject(notFound);
        await expect(repertoires.moveItem("ausente", "i", "up")).rejects.toMatchObject(notFound);
        await expect(repertoires.updateItem("ausente", "i", { notes: "x" })).rejects.toMatchObject(notFound);
      });

      it("adiciona ao final com posições sequenciais", async () => {
        const repertoire = await repertoireWith(3);
        expect(ordered(repertoire.items).map((item) => item.position)).toEqual([1, 2, 3]);
      });

      it("rejeita música repetida e música inexistente", async () => {
        const repertoire = await repertoireWith(1);

        await expect(repertoires.addSong(repertoire.id, repertoire.items[0].songId)).rejects.toMatchObject({
          code: "song-already-in-repertoire",
        });
        await expect(repertoires.addSong(repertoire.id, "ausente")).rejects.toMatchObject({
          code: "song-not-found",
        });
      });

      it("remove o item e normaliza as posições", async () => {
        const repertoire = await repertoireWith(3);
        const [first, second, third] = ordered(repertoire.items);

        const updated = await repertoires.removeItem(repertoire.id, first.id);

        expect(ordered(updated.items).map((item) => [item.id, item.position])).toEqual([
          [second.id, 1],
          [third.id, 2],
        ]);
      });

      it("move o item mantendo posições sequenciais", async () => {
        const repertoire = await repertoireWith(3);
        const [first, second, third] = ordered(repertoire.items);

        const updated = await repertoires.moveItem(repertoire.id, third.id, "up");

        expect(ordered(updated.items).map((item) => item.id)).toEqual([first.id, third.id, second.id]);
        expect(ordered(updated.items).map((item) => item.position)).toEqual([1, 2, 3]);
      });

      it("não sai dos limites da lista", async () => {
        const repertoire = await repertoireWith(2);
        const [first, second] = ordered(repertoire.items);

        const updated = await repertoires.moveItem(repertoire.id, first.id, "up");

        expect(ordered(updated.items).map((item) => item.id)).toEqual([first.id, second.id]);
      });

      it.each(["removeItem", "moveItem", "updateItem"] as const)(
        "rejeita %s com item inexistente, sem alterar nada",
        async (operation) => {
          const repertoire = await repertoireWith(2);
          const call =
            operation === "removeItem"
              ? repertoires.removeItem(repertoire.id, "ausente")
              : operation === "moveItem"
                ? repertoires.moveItem(repertoire.id, "ausente", "down")
                : repertoires.updateItem(repertoire.id, "ausente", { notes: "x" });

          await expect(call).rejects.toMatchObject({ code: "repertoire-item-not-found" });
          await expect(repertoires.findById(repertoire.id)).resolves.toEqual(repertoire);
        },
      );

      it("altera tom e anotações somente do item indicado", async () => {
        const repertoire = await repertoireWith(2);
        const [target, other] = ordered(repertoire.items);

        const updated = await repertoires.updateItem(repertoire.id, target.id, {
          transposeSemitones: -3,
          notes: "Violão sozinho",
        });

        expect(updated.items.find((item) => item.id === target.id)).toMatchObject({
          transposeSemitones: -3,
          notes: "Violão sozinho",
        });
        expect(updated.items.find((item) => item.id === other.id)).toEqual(other);
      });

      it("remove a anotação quando ela fica vazia", async () => {
        const repertoire = await repertoireWith(1);
        const [item] = repertoire.items;
        await repertoires.updateItem(repertoire.id, item.id, { notes: "Algo" });

        const updated = await repertoires.updateItem(repertoire.id, item.id, { notes: "" });

        expect(updated.items[0]).not.toHaveProperty("notes");
      });

      it("rejeita tom fora da faixa", async () => {
        const repertoire = await repertoireWith(1);

        await expect(
          repertoires.updateItem(repertoire.id, repertoire.items[0].id, { transposeSemitones: 12 }),
        ).rejects.toMatchObject({ code: "invalid-data" });
      });

      it("não aceita tom em música com link externo", async () => {
        const song = await songs.create(external);
        const repertoire = await repertoires.create({ name: "R", description: "" });
        const { items } = await repertoires.addSong(repertoire.id, song.id);

        await expect(
          repertoires.updateItem(repertoire.id, items[0].id, { transposeSemitones: 2 }),
        ).rejects.toMatchObject({ code: "invalid-data" });
      });

      it("atualiza updatedAt em alterações de itens", async () => {
        const repertoire = await repertoireWith(1);
        vi.useFakeTimers({ now: new Date("2030-01-01T00:00:00.000Z"), toFake: ["Date"] });

        const updated = await repertoires.updateItem(repertoire.id, repertoire.items[0].id, { notes: "x" });
        vi.useRealTimers();

        expect(updated.updatedAt).toBe("2030-01-01T00:00:00.000Z");
      });
    });

    describe("controle de versão", () => {
      it("documentos novos começam na revisão 1", async () => {
        const song = await raw.songs.create(hosted);
        const repertoire = await raw.repertoires.create({ name: "R", description: "" });

        expect(song.revision).toBe(1);
        expect(repertoire.revision).toBe(1);
      });

      it("cada alteração confirmada aumenta a revisão, sem mudar createdAt", async () => {
        const song = await raw.songs.create(hosted);
        const updated = await raw.songs.update(song.id, { ...hosted, title: "Novo" }, 1);

        expect(updated.revision).toBe(2);
        expect(updated.createdAt).toBe(song.createdAt);
        expect((await raw.songs.findById(song.id))?.revision).toBe(2);
      });

      it("uma revisão antiga não altera a música", async () => {
        const song = await raw.songs.create(hosted);
        await raw.songs.update(song.id, { ...hosted, title: "Primeira" }, 1);

        await expect(raw.songs.update(song.id, { ...hosted, title: "Segunda" }, 1)).rejects.toMatchObject({
          code: "revision-conflict",
        });
        expect(await raw.songs.findById(song.id)).toMatchObject({ title: "Primeira", revision: 2 });
      });

      it("recusa escrita sem revisão esperada", async () => {
        const song = await raw.songs.create(hosted);
        const missing = undefined as unknown as number;

        await expect(raw.songs.update(song.id, hosted, missing)).rejects.toMatchObject({
          code: "revision-required",
        });
        await expect(raw.songs.delete(song.id, missing)).rejects.toMatchObject({ code: "revision-required" });
        expect((await raw.songs.findById(song.id))?.revision).toBe(1);
      });

      it("excluir com revisão antiga falha e preserva a música", async () => {
        const song = await raw.songs.create(hosted);
        await raw.songs.update(song.id, { ...hosted, title: "Alterada" }, 1);

        await expect(raw.songs.delete(song.id, 1)).rejects.toMatchObject({ code: "revision-conflict" });
        expect(await raw.songs.findById(song.id)).toMatchObject({ title: "Alterada" });
        await raw.songs.delete(song.id, 2);
        expect(await raw.songs.findById(song.id)).toBeNull();
      });

      it("uma gravação antiga não recria o que foi excluído", async () => {
        const song = await raw.songs.create(hosted);
        await raw.songs.delete(song.id, 1);

        await expect(raw.songs.update(song.id, hosted, 1)).rejects.toMatchObject({ code: "song-not-found" });
        expect(await raw.songs.findById(song.id)).toBeNull();
      });

      it("toda operação de item aumenta a revisão do repertório", async () => {
        const first = await raw.songs.create(hosted);
        const second = await raw.songs.create({ ...hosted, title: "Segunda" });
        let repertoire = await raw.repertoires.create({ name: "R", description: "" });

        repertoire = await raw.repertoires.addSong(repertoire.id, first.id, 1);
        expect(repertoire.revision).toBe(2);
        repertoire = await raw.repertoires.addSong(repertoire.id, second.id, 2);
        const [a, b] = repertoire.items;
        repertoire = await raw.repertoires.updateItem(repertoire.id, a.id, { transposeSemitones: 2 }, 3);
        expect(repertoire.revision).toBe(4);
        repertoire = await raw.repertoires.updateItem(repertoire.id, a.id, { notes: "Nota" }, 4);
        expect(repertoire.revision).toBe(5);
        repertoire = await raw.repertoires.moveItem(repertoire.id, b.id, "up", 5);
        expect(repertoire.revision).toBe(6);
        repertoire = await raw.repertoires.removeItem(repertoire.id, b.id, 6);
        expect(repertoire.revision).toBe(7);
        repertoire = await raw.repertoires.update(repertoire.id, { name: "R2", description: "" }, 7);
        expect(repertoire.revision).toBe(8);
      });

      it("tom e anotações com revisão antiga não sobrescrevem a versão atual", async () => {
        const song = await raw.songs.create(hosted);
        const created = await raw.repertoires.create({ name: "R", description: "" });
        const repertoire = await raw.repertoires.addSong(created.id, song.id, 1);
        const item = repertoire.items[0];

        await raw.repertoires.updateItem(repertoire.id, item.id, { transposeSemitones: 3 }, 2);

        await expect(
          raw.repertoires.updateItem(repertoire.id, item.id, { notes: "Antiga" }, 2),
        ).rejects.toMatchObject({ code: "revision-conflict" });
        const current = await raw.repertoires.findById(repertoire.id);
        expect(current?.items[0]).toMatchObject({ transposeSemitones: 3 });
        expect(current?.items[0].notes).toBeUndefined();

        const redone = await raw.repertoires.updateItem(repertoire.id, item.id, { notes: "Refeita" }, 3);
        expect(redone.items[0]).toMatchObject({ transposeSemitones: 3, notes: "Refeita" });
      });

      it("reordenar, incluir e remover também exigem a revisão atual", async () => {
        const song = await raw.songs.create(hosted);
        const other = await raw.songs.create({ ...hosted, title: "Outra" });
        const created = await raw.repertoires.create({ name: "R", description: "" });
        const repertoire = await raw.repertoires.addSong(created.id, song.id, 1);
        const [item] = repertoire.items;

        const conflict = { code: "revision-conflict" };
        await expect(raw.repertoires.addSong(repertoire.id, other.id, 1)).rejects.toMatchObject(conflict);
        await expect(raw.repertoires.moveItem(repertoire.id, item.id, "down", 1)).rejects.toMatchObject(conflict);
        await expect(raw.repertoires.removeItem(repertoire.id, item.id, 1)).rejects.toMatchObject(conflict);
        await expect(raw.repertoires.update(repertoire.id, { name: "X", description: "" }, 1)).rejects.toMatchObject(conflict);
        await expect(raw.repertoires.delete(repertoire.id, 1)).rejects.toMatchObject(conflict);

        expect(await raw.repertoires.findById(repertoire.id)).toMatchObject({ revision: 2, name: "R" });
      });
    });
  });
}
