import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseLibraryDocument } from "@/features/library/data/library-storage";
import { demoSongs } from "@/features/songs/data/demo-songs";

import { MAX_ITEM_NOTES_LENGTH } from "@/features/repertoires/domain/repertoire-schema";
import { parseRepertoireItemNotes } from "@/features/repertoires/services/repertoire-form";
import { buildRepertoireEntries } from "@/features/repertoires/services/repertoire-service";
import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import type { RepertoireRepository } from "@/features/repertoires/data/repertoire-repository";
import { createFakeRepertoireRepository } from "./fake-repertoire-repository";
import { createMemoryLibraryStore, type LibraryStore } from "./memory-library-store";
// Escritas destes testes usam a revisão atual; a concorrência tem testes próprios.
import { latestOf as L } from "@/test/latest-revision";
import { versionedSongs } from "@/test/fixtures";

const seed = { songs: demoSongs, repertoires: demoRepertoires };
const SARAU = "rep-sarau-de-domingo";
const ENSAIO = "rep-ensaio-acustico";
const SARAU_CORACAO = "item-sarau-coracao";
const ENSAIO_CORACAO = "item-ensaio-coracao";

let repository: RepertoireRepository;

let store: LibraryStore;


beforeEach(() => {
  store = createMemoryLibraryStore(seed);
  repository = createFakeRepertoireRepository(
    store,
  );
});

function reopen(): RepertoireRepository {
  return createFakeRepertoireRepository(
    store,
  );
}

async function item(repertoireId: string, itemId: string) {
  const repertoire = await repository.findById(repertoireId);
  return repertoire?.items.find((candidate) => candidate.id === itemId);
}

describe("updateItem: tom", () => {
  it("persiste o deslocamento apenas no item alterado", async () => {
    await L(repository).updateItem(SARAU, SARAU_CORACAO, { transposeSemitones: -3 });

    const reopened = await reopen().findById(SARAU);
    expect(reopened?.items.find((i) => i.id === SARAU_CORACAO)?.transposeSemitones).toBe(-3);
    expect(reopened?.items.find((i) => i.id === "item-sarau-caminhos")?.transposeSemitones).toBe(0);
  });

  it("mantém deslocamentos independentes entre repertórios", async () => {
    await L(repository).updateItem(SARAU, SARAU_CORACAO, { transposeSemitones: -2 });

    expect((await item(SARAU, SARAU_CORACAO))?.transposeSemitones).toBe(-2);
    expect((await item(ENSAIO, ENSAIO_CORACAO))?.transposeSemitones).toBe(2);
  });

  it("preserva anotações, posição e música ao mudar o tom", async () => {
    const before = await item(SARAU, "item-sarau-luz");

    await L(repository).updateItem(SARAU, "item-sarau-luz", { transposeSemitones: 1 });

    expect(await item(SARAU, "item-sarau-luz")).toEqual({ ...before, transposeSemitones: 1 });
  });

  it("atualiza updatedAt e preserva createdAt", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-01T10:00:00.000Z") });
    const before = await repository.findById(SARAU);

    const updated = await L(repository).updateItem(SARAU, SARAU_CORACAO, { transposeSemitones: 1 });
    vi.useRealTimers();

    expect(updated.updatedAt).toBe("2026-11-01T10:00:00.000Z");
    expect(updated.createdAt).toBe(before?.createdAt);
  });

  it.each([12, -12, 1.5, Number.NaN])("rejeita o deslocamento %d sem gravar", async (value) => {
    const raw = () => JSON.stringify(store.read());
    await repository.list();
    const before = raw();

    await expect(
      L(repository).updateItem(SARAU, SARAU_CORACAO, { transposeSemitones: value }),
    ).rejects.toMatchObject({ code: "invalid-data" });
    expect(raw()).toBe(before);
  });

  it("aceita os limites da faixa", async () => {
    await L(repository).updateItem(SARAU, SARAU_CORACAO, { transposeSemitones: 11 });
    await L(repository).updateItem(SARAU, "item-sarau-caminhos", { transposeSemitones: -11 });

    expect((await item(SARAU, SARAU_CORACAO))?.transposeSemitones).toBe(11);
    expect((await item(SARAU, "item-sarau-caminhos"))?.transposeSemitones).toBe(-11);
  });

  it("não aceita tom em música com link externo", async () => {
    await expect(
      L(repository).updateItem(SARAU, "item-sarau-noite", { transposeSemitones: 2 }),
    ).rejects.toMatchObject({ code: "invalid-data" });
  });

  it("não altera a música original", async () => {
    await L(repository).updateItem(SARAU, "item-sarau-caminhos", { transposeSemitones: 5 });

    const stored = JSON.parse(JSON.stringify(store.read()));
    expect(stored.songs.find((s: { id: string }) => s.id === "song-caminhos")).toEqual(versionedSongs[0]);
  });
});

describe("updateItem: anotações", () => {
  it("salva anotações próprias de cada repertório", async () => {
    await L(repository).updateItem(SARAU, SARAU_CORACAO, { notes: "Violão sozinho" });
    await L(repository).updateItem(ENSAIO, ENSAIO_CORACAO, { notes: "Com bateria" });

    expect((await item(SARAU, SARAU_CORACAO))?.notes).toBe("Violão sozinho");
    expect((await item(ENSAIO, ENSAIO_CORACAO))?.notes).toBe("Com bateria");
  });

  it("remove o campo quando a anotação fica vazia", async () => {
    await L(repository).updateItem(SARAU, "item-sarau-caminhos", { notes: "   " });

    expect(await item(SARAU, "item-sarau-caminhos")).not.toHaveProperty("notes");
  });

  it("não mexe nas anotações quando só o tom muda", async () => {
    await L(repository).updateItem(SARAU, "item-sarau-caminhos", { transposeSemitones: 1 });

    expect((await item(SARAU, "item-sarau-caminhos"))?.notes).toBe("Abrir só com o violão.");
  });

  it("guarda marcação como texto comum", async () => {
    const notes = "<img src=x onerror=alert(1)>";
    await L(repository).updateItem(SARAU, SARAU_CORACAO, { notes });
    expect((await item(SARAU, SARAU_CORACAO))?.notes).toBe(notes);
  });

  it("rejeita anotações longas demais", async () => {
    await expect(
      L(repository).updateItem(SARAU, SARAU_CORACAO, { notes: "x".repeat(MAX_ITEM_NOTES_LENGTH + 1) }),
    ).rejects.toMatchObject({ code: "invalid-data" });
  });
});

describe("updateItem: referências inválidas", () => {
  it("rejeita repertório inexistente", async () => {
    await expect(
      L(repository).updateItem("nao-existe", SARAU_CORACAO, { notes: "x" }),
    ).rejects.toMatchObject({ code: "repertoire-not-found" });
  });

  it("rejeita item inexistente", async () => {
    await expect(L(repository).updateItem(SARAU, "nao-existe", { notes: "x" })).rejects.toMatchObject({
      code: "repertoire-item-not-found",
    });
  });

  it("rejeita item de outro repertório", async () => {
    await expect(L(repository).updateItem(SARAU, ENSAIO_CORACAO, { notes: "x" })).rejects.toMatchObject({
      code: "repertoire-item-not-found",
    });
  });

  it("rejeita campos desconhecidos", async () => {
    await expect(
      L(repository).updateItem(SARAU, SARAU_CORACAO, { songId: "outra" } as never),
    ).rejects.toMatchObject({ code: "invalid-data" });
  });

});

describe("compatibilidade do armazenamento", () => {
  const baseDocument = { schemaVersion: 1, songs: demoSongs };

  it("continua aceitando os dados já salvos na versão 1", () => {
    expect(parseLibraryDocument({ ...baseDocument, repertoires: demoRepertoires }).status).toBe("ok");
  });

  it("rejeita deslocamento salvo fora da faixa", () => {
    const repertoires = demoRepertoires.map((repertoire) => ({
      ...repertoire,
      items: repertoire.items.map((entry) => ({ ...entry, transposeSemitones: 99 })),
    }));
    expect(parseLibraryDocument({ ...baseDocument, repertoires }).status).toBe("invalid");
  });
});

describe("tom exibido no repertório", () => {
  const items = demoRepertoires[0].items;

  it("deriva o tom sem alterar o tom original da música", () => {
    const entry = buildRepertoireEntries(items, versionedSongs).find(
      (candidate) => candidate.item.id === "item-sarau-luz",
    );
    expect(entry?.preferredKey).toBe("C");
    expect(entry?.song?.originalKey).toBe("D");
  });

  it("fica relativo ao novo tom quando o tom original da música muda", () => {
    const changed = versionedSongs.map((song) =>
      song.id === "song-luz-da-varanda" ? { ...song, originalKey: "G" as const } : song,
    );
    const entry = buildRepertoireEntries(items, changed).find(
      (candidate) => candidate.item.id === "item-sarau-luz",
    );
    expect(entry?.item.transposeSemitones).toBe(-2);
    expect(entry?.preferredKey).toBe("F");
  });

  it("não deriva tom para link externo", () => {
    const external = items.map((entry) =>
      entry.id === "item-sarau-noite" ? { ...entry, transposeSemitones: 2 } : entry,
    );
    const entry = buildRepertoireEntries(external, versionedSongs).find(
      (candidate) => candidate.item.id === "item-sarau-noite",
    );
    expect(entry?.preferredKey).toBeNull();
  });
});

describe("parseRepertoireItemNotes", () => {
  it("remove espaços das pontas e aceita vazio", () => {
    expect(parseRepertoireItemNotes("  Oi  ")).toEqual({ success: true, notes: "Oi" });
    expect(parseRepertoireItemNotes("   ")).toEqual({ success: true, notes: "" });
  });

  it("explica o limite em português", () => {
    expect(parseRepertoireItemNotes("x".repeat(MAX_ITEM_NOTES_LENGTH + 1))).toEqual({
      success: false,
      error: "As anotações devem ter no máximo 500 caracteres.",
    });
  });
});
