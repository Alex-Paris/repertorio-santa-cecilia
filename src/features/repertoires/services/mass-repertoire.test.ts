import { describe, expect, it } from "vitest";

import { parseLibraryDocument } from "@/features/library/data/library-storage";
import { createLibraryBackup, parseLibraryBackupDocument } from "@/features/library/services/library-backup";
import { createFakeRepertoireRepository } from "@/test/fakes/fake-repertoire-repository";
import { createMemoryLibraryStore } from "@/test/fakes/memory-library-store";
import { versionedLibrary } from "@/test/fixtures";

import type { Repertoire, RepertoireItem } from "../domain/repertoire";
import {
  repertoireInputSchema,
  repertoireItemChangesSchema,
  repertoireMassSchema,
  repertoireSchema,
} from "../domain/repertoire-schema";
import { appendRepertoireItem, applyRepertoireItemChanges } from "./repertoire-items";

const dates = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const MASS = { date: "2026-11-22", celebrationId: "2026-11-22-cristo-rei", title: "Cristo Rei" };

function item(id: string, position: number, moment?: RepertoireItem["moment"]): RepertoireItem {
  return { id, songId: `song-${id}`, source: "catalog", position, transposeSemitones: 0, ...(moment ? { moment } : {}) };
}

const order = (items: RepertoireItem[]) => items.map((entry) => entry.id);

describe("música adicionada com momento litúrgico", () => {
  const base = [item("entrada", 1, "entrada"), item("oferendas", 2, "preparacao-das-oferendas"), item("final", 3, "encerramento")];

  it("entra na ordem da missa", () => {
    const next = appendRepertoireItem(base, "s", "comunhao", "catalog", "comunhao");

    expect(order(next)).toEqual(["entrada", "oferendas", "comunhao", "final"]);
    expect(next.map((entry) => entry.position)).toEqual([1, 2, 3, 4]);
    expect(next[2]).toMatchObject({ moment: "comunhao", source: "catalog", transposeSemitones: 0 });
  });

  it("fica depois de outra música do mesmo momento", () => {
    const next = appendRepertoireItem(base, "s", "outra-entrada", "catalog", "entrada");
    expect(order(next)).toEqual(["entrada", "outra-entrada", "oferendas", "final"]);
  });

  it("antes de todas, quando o momento é anterior a todos", () => {
    const later = [item("comunhao", 1, "comunhao"), item("final", 2, "encerramento")];
    expect(order(appendRepertoireItem(later, "s", "entrada", "catalog", "entrada"))).toEqual(["entrada", "comunhao", "final"]);
  });

  it("sem momento, vai para o fim, como antes", () => {
    expect(order(appendRepertoireItem(base, "s", "ensaio"))).toEqual(["entrada", "oferendas", "final", "ensaio"]);
    expect(appendRepertoireItem(base, "s", "ensaio").at(-1)).not.toHaveProperty("moment");
  });

  it("não reordena músicas sem momento", () => {
    const mixed = [item("livre-1", 1), item("comunhao", 2, "comunhao"), item("livre-2", 3)];
    expect(order(appendRepertoireItem(mixed, "s", "entrada", "catalog", "entrada"))).toEqual([
      "livre-1",
      "entrada",
      "comunhao",
      "livre-2",
    ]);
  });

  it("em repertório sem nenhum momento, vai para o fim", () => {
    const plain = [item("a", 1), item("b", 2)];
    expect(order(appendRepertoireItem(plain, "s", "c", "catalog", "comunhao"))).toEqual(["a", "b", "c"]);
  });
});

describe("alterações de um item", () => {
  const current: RepertoireItem = { ...item("a", 1, "entrada"), notes: "Nota", transposeSemitones: 2 };

  it("alterar o tom preserva o momento e as anotações", () => {
    expect(applyRepertoireItemChanges(current, { transposeSemitones: -1 })).toEqual({ ...current, transposeSemitones: -1 });
  });

  it("troca e remove o momento", () => {
    expect(applyRepertoireItemChanges(current, { moment: "comunhao" }).moment).toBe("comunhao");
    expect(applyRepertoireItemChanges(current, { moment: null })).not.toHaveProperty("moment");
  });

  it("valida o momento contra o vocabulário", () => {
    expect(repertoireItemChangesSchema.safeParse({ moment: "comunhao" }).success).toBe(true);
    expect(repertoireItemChangesSchema.safeParse({ moment: null }).success).toBe(true);
    expect(repertoireItemChangesSchema.safeParse({ moment: "intervalo" }).success).toBe(false);
  });
});

describe("dados da missa no repertório", () => {
  it("são opcionais: um repertório de ensaio continua válido", () => {
    const rehearsal = { ...dates, id: "r", name: "Ensaio", description: "", revision: 1, items: [item("a", 1)] };
    expect(repertoireSchema.safeParse(rehearsal).success).toBe(true);
    expect(repertoireInputSchema.safeParse({ name: "Ensaio", description: "" }).success).toBe(true);
  });

  it("validam a data e o nome da celebração", () => {
    expect(repertoireMassSchema.safeParse(MASS).success).toBe(true);
    expect(repertoireMassSchema.safeParse({ date: "2026-11-22", title: "Missa de domingo" }).success).toBe(true);
    expect(repertoireMassSchema.safeParse({ ...MASS, date: "2026-02-30" }).success).toBe(false);
    expect(repertoireMassSchema.safeParse({ ...MASS, title: "  " }).success).toBe(false);
    expect(repertoireMassSchema.safeParse({ ...MASS, celebrationId: "Com Espaço" }).success).toBe(false);
    expect(repertoireMassSchema.safeParse({ ...MASS, ownerId: "x" }).success).toBe(false);
  });

  it("criar a partir de uma celebração, manter ao editar e desvincular só a pedido", async () => {
    const repertoires = createFakeRepertoireRepository(createMemoryLibraryStore());

    const created = await repertoires.create({ name: "Missa", description: "", mass: MASS });
    expect(created.mass).toEqual(MASS);

    // Editar nome e descrição não mexe na missa.
    const renamed = await repertoires.update(created.id, { name: "Missa das 10h", description: "" }, created.revision);
    expect(renamed.mass).toEqual(MASS);

    const unlinked = await repertoires.update(created.id, { name: "Ensaio", description: "", mass: null }, renamed.revision);
    expect(unlinked).not.toHaveProperty("mass");

    const plain = await repertoires.create({ name: "Playlist", description: "" });
    expect(plain).not.toHaveProperty("mass");
  });

  it("adiciona a música sugerida com o momento, e o tom continua por item", async () => {
    const repertoires = createFakeRepertoireRepository(createMemoryLibraryStore(), () => true);
    const created = await repertoires.create({ name: "Missa", description: "", mass: MASS });

    const first = await repertoires.addSong(created.id, "cat-final", created.revision, "catalog", "encerramento");
    const second = await repertoires.addSong(created.id, "cat-entrada", first.revision, "catalog", "entrada");
    expect(second.items.map((entry) => [entry.songId, entry.moment])).toEqual([
      ["cat-entrada", "entrada"],
      ["cat-final", "encerramento"],
    ]);

    const toned = await repertoires.updateItem(created.id, second.items[0].id, { transposeSemitones: 3 }, second.revision);
    expect(toned.items[0]).toMatchObject({ moment: "entrada", transposeSemitones: 3 });
    expect(toned.items[1]).toMatchObject({ moment: "encerramento", transposeSemitones: 0 });
  });
});

describe("backup com dados de missa", () => {
  const massRepertoire: Repertoire = {
    ...dates,
    id: "r-missa",
    name: "Missa",
    description: "",
    revision: 4,
    mass: MASS,
    items: [item("a", 1, "entrada"), { ...versionedLibrary.repertoires[0].items[0], id: "b", position: 2 }],
  };

  it("usa a versão 3 e guarda a celebração e os momentos", () => {
    const backup = createLibraryBackup(
      { songs: versionedLibrary.songs, repertoires: [massRepertoire] },
      new Date("2026-11-13T00:00:00.000Z"),
    );

    expect(backup.schemaVersion).toBe(3);
    expect(backup.repertoires[0].mass).toEqual(MASS);
    expect(backup.repertoires[0].items[0]).toMatchObject({ moment: "entrada", source: "catalog" });
    expect(JSON.stringify(backup)).not.toContain("revision");

    const parsed = parseLibraryBackupDocument(JSON.parse(JSON.stringify(backup)));
    expect(parsed.status).toBe("ok");
    if (parsed.status === "ok") {
      expect(parsed.library.repertoires[0].mass).toEqual(MASS);
      expect(parsed.library.repertoires[0].items[0].moment).toBe("entrada");
    }
  });

  it("sem dados de missa, mantém as versões 1 e 2", () => {
    const personalOnly = createLibraryBackup(versionedLibrary, new Date());
    expect(personalOnly.schemaVersion).toBe(1);

    const withCatalog = createLibraryBackup(
      { songs: [], repertoires: [{ ...massRepertoire, mass: undefined, items: [item("a", 1)] }] },
      new Date(),
    );
    expect(withCatalog.schemaVersion).toBe(2);
    expect(JSON.stringify(withCatalog)).not.toContain("moment");
  });

  it("um arquivo das versões 1 ou 2 não pode trazer dados de missa", () => {
    const record = { ...dates, id: "r", name: "R", description: "" };
    const withMass = { ...record, mass: MASS, items: [] };
    const withMoment = { ...record, items: [{ ...item("a", 1, "entrada") }] };

    for (const schemaVersion of [1, 2]) {
      expect(parseLibraryDocument({ schemaVersion, songs: [], repertoires: [withMass] }).status).toBe("invalid");
      expect(parseLibraryDocument({ schemaVersion, songs: [], repertoires: [withMoment] }).status).toBe("invalid");
    }
    expect(parseLibraryDocument({ schemaVersion: 3, songs: [], repertoires: [withMass] }).status).toBe("ok");
  });

  it("backups antigos, das versões 1 e 2, continuam sendo lidos", () => {
    const v1 = createLibraryBackup(versionedLibrary, new Date());
    const v2 = { schemaVersion: 2, songs: [], repertoires: [{ ...dates, id: "r", name: "R", description: "", items: [item("a", 1)] }] };

    expect(parseLibraryBackupDocument(JSON.parse(JSON.stringify(v1))).status).toBe("ok");
    expect(parseLibraryDocument(v2).status).toBe("ok");
    expect(parseLibraryDocument({ ...v2, schemaVersion: 4 }).status).toBe("newer-version");
  });
});
