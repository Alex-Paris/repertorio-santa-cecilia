// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { LibraryRecord } from "@/features/library/domain/library";
import { LibraryError } from "@/features/library/domain/library-errors";
import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import { demoSongs } from "@/features/songs/data/demo-songs";
import { toErrorResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";

import { hashLibrary, IMPORT_LIMITS, importRequestSchema, MAX_IMPORT_BODY_BYTES, validateBackup } from "./import-validation";
import {
  createLibraryImportService,
  type LibraryImportRecord,
  type LibraryImportStore,
} from "./library-import-service";

const IMPORT_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const OTHER_IMPORT_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

const backup = {
  schemaVersion: 1,
  exportedAt: "2026-11-08T12:00:00.000Z",
  songs: demoSongs,
  repertoires: demoRepertoires,
};

const song = {
  id: "s1",
  title: "T",
  artist: "A",
  originalKey: "G",
  contentType: "original",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const repertoire = {
  id: "r1",
  name: "R",
  description: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  items: [{ id: "i1", songId: "s1", position: 1, transposeSemitones: 0 }],
};

function envelope(songs: unknown[], repertoires: unknown[] = []) {
  return { schemaVersion: 1, songs, repertoires };
}

function expectInvalid(document: unknown, message?: RegExp): void {
  try {
    validateBackup(document);
    expect.unreachable("deveria rejeitar");
  } catch (error) {
    expect(error).toBeInstanceOf(LibraryError);
    expect(error).toMatchObject({ code: "invalid-data" });
    if (message) {
      expect((error as Error).message).toMatch(message);
    }
  }
}

function createFakeStore(initial: { songs?: number; repertoires?: number } = {}) {
  const state = {
    songs: initial.songs ?? 0,
    repertoires: initial.repertoires ?? 0,
    inserted: [] as LibraryRecord[],
    records: new Map<string, LibraryImportRecord>(),
    writes: 0,
  };

  const store: LibraryImportStore = {
    transaction: (work) =>
      work({
        findRecord: async (id) => state.records.get(id) ?? null,
        reserveLibrary: async () => {
          state.writes++;
        },
        isLibraryEmpty: async () => state.songs === 0 && state.repertoires === 0,
        insertLibrary: async (library) => {
          state.writes++;
          state.inserted.push(library);
          state.songs += library.songs.length;
          state.repertoires += library.repertoires.length;
        },
        saveRecord: async (record) => {
          state.writes++;
          state.records.set(record.importId, record);
        },
      }),
    findRecord: async (id) => state.records.get(id) ?? null,
    countRemote: async () => ({ songs: state.songs, repertoires: state.repertoires }),
  };

  return { state, service: createLibraryImportService(store) };
}

describe("validação do envelope", () => {
  it("aceita um backup exportado pelo aplicativo", () => {
    const result = validateBackup(backup);

    expect(result.counts).toEqual({ songs: 6, repertoires: 2, items: 7 });
    expect(result.schemaVersion).toBe(1);
    expect(result.exportedAt).toBe("2026-11-08T12:00:00.000Z");
  });

  it("aceita backup sem exportedAt", () => {
    expect(validateBackup(envelope([song], [repertoire])).exportedAt).toBeNull();
  });

  it.each([null, [], "texto", 3, {}, { songs: [], repertoires: [] }])("rejeita %j", (document) => {
    expectInvalid(document);
  });

  it("rejeita versão mais recente", () => {
    expectInvalid({ ...envelope([]), schemaVersion: 99 }, /versão mais recente/);
  });

  it("rejeita versão anterior sem migração", () => {
    expectInvalid({ ...envelope([]), schemaVersion: 0 }, /não é suportada/);
  });

  it("rejeita campo desconhecido no envelope", () => {
    expectInvalid({ ...envelope([]), extra: true });
  });
});

describe("identificadores e referências", () => {
  it("rejeita músicas duplicadas", () => {
    expectInvalid(envelope([song, song]), /mesmo ID/);
  });

  it("rejeita repertórios duplicados", () => {
    expectInvalid(envelope([song], [repertoire, repertoire]), /mesmo ID/);
  });

  it("rejeita a mesma música duas vezes em um repertório", () => {
    expectInvalid(
      envelope([song], [{ ...repertoire, items: [repertoire.items[0], { ...repertoire.items[0], id: "i2", position: 2 }] }]),
      /repetidas/,
    );
  });

  it("rejeita referência a música inexistente", () => {
    expectInvalid(
      envelope([song], [{ ...repertoire, items: [{ ...repertoire.items[0], songId: "fantasma" }] }]),
      /inexistentes/,
    );
  });

  it("rejeita posições repetidas", () => {
    const second = { ...song, id: "s2" };
    expectInvalid(
      envelope([song, second], [{ ...repertoire, items: [repertoire.items[0], { ...repertoire.items[0], id: "i2", songId: "s2" }] }]),
      /posições repetidas/,
    );
  });

  it("rejeita ID acima do limite", () => {
    expectInvalid(envelope([{ ...song, id: "x".repeat(129) }]));
  });
});

describe("propriedades sensíveis", () => {
  it.each([
    ["ownerId na música", envelope([{ ...song, ownerId: "outro" }])],
    ["_id na música", envelope([{ ...song, _id: "abc" }])],
    ["ownerId no repertório", envelope([song], [{ ...repertoire, ownerId: "outro" }])],
    ["ownerId no item", envelope([song], [{ ...repertoire, items: [{ ...repertoire.items[0], ownerId: "x" }] }])],
    ["ownerId no envelope", { ...envelope([song]), ownerId: "outro" }],
    ["credenciais no envelope", { ...envelope([song]), password: "x" }],
    ["campo administrativo", { ...envelope([song]), isAdmin: true }],
  ])("rejeita %s", (_name, document) => {
    expectInvalid(document);
  });

  it("rejeita ownerId no corpo da requisição", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ importId: IMPORT_ID, backup, ownerId: "outro" }),
    });

    await expect(readJsonBody(request, importRequestSchema)).rejects.toMatchObject({ status: 400 });
  });

  it("exige importId em formato UUID", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ importId: "123", backup }),
    });

    await expect(readJsonBody(request, importRequestSchema)).rejects.toMatchObject({ status: 400 });
  });
});

describe("campos validados", () => {
  it.each([
    ["data inválida", envelope([{ ...song, createdAt: "ontem" }])],
    ["tom inexistente", envelope([{ ...song, originalKey: "H" }])],
    ["tipo desconhecido", envelope([{ ...song, contentType: "pirata" }])],
    ["URL perigosa", envelope([{ ...song, contentType: "external-link", sourceUrl: "javascript:alert(1)" }])],
    ["cifra em link externo", envelope([{ ...song, contentType: "external-link", sourceUrl: "https://a.com", chordPro: "[G]" }])],
    ["título grande demais", envelope([{ ...song, title: "x".repeat(301) }])],
    ["cifra grande demais", envelope([{ ...song, chordPro: "x".repeat(100_001) }])],
    ["semitons acima da faixa", envelope([song], [{ ...repertoire, items: [{ ...repertoire.items[0], transposeSemitones: 12 }] }])],
    ["semitons abaixo da faixa", envelope([song], [{ ...repertoire, items: [{ ...repertoire.items[0], transposeSemitones: -12 }] }])],
    ["anotação grande demais", envelope([song], [{ ...repertoire, items: [{ ...repertoire.items[0], notes: "x".repeat(501) }] }])],
    ["posição inválida", envelope([song], [{ ...repertoire, items: [{ ...repertoire.items[0], position: 0 }] }])],
  ])("rejeita %s", (_name, document) => {
    expectInvalid(document);
  });

  it("não corrige espaços silenciosamente", () => {
    expectInvalid(envelope([{ ...song, title: "  Com espaços  " }]), /fora do formato/);
  });

  it("aceita os limites de semitons", () => {
    const items = [{ ...repertoire.items[0], transposeSemitones: 11 }];
    expect(validateBackup(envelope([song], [{ ...repertoire, items }])).counts.items).toBe(1);
  });
});

describe("limites de entrada", () => {
  it.each([
    ["músicas", { schemaVersion: 1, songs: new Array(IMPORT_LIMITS.songs + 1).fill(null), repertoires: [] }],
    ["repertórios", { schemaVersion: 1, songs: [], repertoires: new Array(IMPORT_LIMITS.repertoires + 1).fill(null) }],
    ["itens", { schemaVersion: 1, songs: [], repertoires: [{ items: new Array(IMPORT_LIMITS.items + 1).fill(null) }] }],
  ])("recusa quantidade excessiva de %s antes de validar", (_name, document) => {
    expect(() => validateBackup(document)).toThrowError(
      expect.objectContaining({ code: "import-limit-exceeded" }),
    );
  });

  it("responde 413 quando o corpo excede o limite, mesmo sem Content-Length", async () => {
    const chunk = new Uint8Array(1024 * 1024).fill(32);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent++;
        controller.enqueue(chunk);
        if (sent > 20) {
          controller.close();
        }
      },
    });
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit);

    await expect(readJsonBody(request, importRequestSchema, MAX_IMPORT_BODY_BYTES)).rejects.toMatchObject({ status: 413 });
    expect(sent).toBeLessThanOrEqual(8);
  });
});

describe("hash de conteúdo", () => {
  it("não depende da ordem das chaves", () => {
    const reversed = Object.fromEntries(Object.entries(song).reverse());
    const a = { songs: [song], repertoires: [] } as unknown as LibraryRecord;
    const b = { repertoires: [], songs: [reversed] } as unknown as LibraryRecord;

    expect(hashLibrary(a)).toBe(hashLibrary(b));
  });

  it("ignora exportedAt", () => {
    const first = validateBackup(backup).contentHash;
    const second = validateBackup({ ...backup, exportedAt: "2030-01-01T00:00:00.000Z" }).contentHash;
    expect(first).toBe(second);
  });

  it("muda quando o conteúdo muda", () => {
    expect(validateBackup(envelope([song])).contentHash).not.toBe(
      validateBackup(envelope([{ ...song, title: "Outro" }])).contentHash,
    );
  });
});

describe("preservação dos dados", () => {
  it("entrega ao armazenamento os dados exatamente como vieram", async () => {
    const { state, service } = createFakeStore();
    const noted = {
      ...repertoire,
      items: [
        { id: "i2", songId: "s1", position: 7, transposeSemitones: -3, notes: "Violão" },
      ],
    };

    await service.execute({ importId: IMPORT_ID, backup: envelope([song], [noted]) });

    expect(state.inserted[0].songs[0]).toEqual(song);
    expect(state.inserted[0].repertoires[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(state.inserted[0].repertoires[0].updatedAt).toBe("2026-01-02T00:00:00.000Z");
    // A versão 1 não tinha a origem: todo item importado dela é particular.
    expect(state.inserted[0].repertoires[0].items).toEqual(
      noted.items.map((item) => ({ ...item, source: "personal" })),
    );
  });

  it("mantém a ordem dos itens recebida", async () => {
    const { state, service } = createFakeStore();

    await service.execute({ importId: IMPORT_ID, backup });

    const ensaio = state.inserted[0].repertoires.find((r) => r.id === "rep-ensaio-acustico");
    expect(ensaio?.items.map((item) => item.position)).toEqual([3, 1, 2]);
  });
});

describe("preview", () => {
  it("resume o backup sem gravar nada", async () => {
    const { state, service } = createFakeStore();

    const preview = await service.preview({ backup });

    expect(preview).toEqual({
      summary: { songs: 6, repertoires: 2, items: 7, schemaVersion: 1, exportedAt: "2026-11-08T12:00:00.000Z" },
      remote: { songs: 0, repertoires: 0, isEmpty: true },
      canImport: true,
      conflicts: [],
    });
    expect(state.writes).toBe(0);
  });

  it("aponta conflito com biblioteca remota preenchida", async () => {
    const { service } = createFakeStore({ songs: 2 });

    await expect(service.preview({ backup })).resolves.toMatchObject({
      canImport: false,
      conflicts: ["remote_library_not_empty"],
      remote: { songs: 2, isEmpty: false },
    });
  });

  it("identifica importação já concluída e reutilização indevida do ID", async () => {
    const { service } = createFakeStore();
    await service.execute({ importId: IMPORT_ID, backup });

    await expect(service.preview({ importId: IMPORT_ID, backup })).resolves.toMatchObject({
      conflicts: expect.arrayContaining(["already_imported"]),
    });
    await expect(
      service.preview({ importId: IMPORT_ID, backup: envelope([song]) }),
    ).resolves.toMatchObject({ conflicts: expect.arrayContaining(["import_id_conflict"]) });
  });

  it("valida o backup também no preview", async () => {
    const { service } = createFakeStore();
    await expect(service.preview({ backup: envelope([song, song]) })).rejects.toMatchObject({ code: "invalid-data" });
  });
});

describe("execução", () => {
  it("retorna um resumo sem conteúdo das músicas", async () => {
    const { service } = createFakeStore();

    const result = await service.execute({ importId: IMPORT_ID, backup });

    expect(result.replayed).toBe(false);
    expect(result.summary).toMatchObject({ importId: IMPORT_ID, songs: 6, repertoires: 2, items: 7, schemaVersion: 1 });
    expect(JSON.stringify(result)).not.toContain("Hoje vou");
    expect(result).not.toHaveProperty("contentHash");
    expect(result.summary).not.toHaveProperty("contentHash");
  });

  it("não grava nada quando o backup é inválido", async () => {
    const { state, service } = createFakeStore();

    await expect(service.execute({ importId: IMPORT_ID, backup: envelope([song, song]) })).rejects.toBeDefined();

    expect(state.writes).toBe(0);
  });

  it("recusa conta preenchida, sem inserir", async () => {
    const { state, service } = createFakeStore({ repertoires: 1 });

    await expect(service.execute({ importId: IMPORT_ID, backup })).rejects.toMatchObject({
      code: "remote-library-not-empty",
    });

    expect(state.inserted).toEqual([]);
    expect(state.records.size).toBe(0);
  });

  it("repetir o mesmo importId e conteúdo devolve o resultado anterior", async () => {
    const { state, service } = createFakeStore();
    const first = await service.execute({ importId: IMPORT_ID, backup });

    const second = await service.execute({ importId: IMPORT_ID, backup: { ...backup, exportedAt: "2030-01-01T00:00:00.000Z" } });

    expect(second).toEqual({ summary: first.summary, replayed: true });
    expect(state.inserted).toHaveLength(1);
  });

  it("mesmo importId com outro conteúdo é conflito", async () => {
    const { state, service } = createFakeStore();
    await service.execute({ importId: IMPORT_ID, backup });

    await expect(service.execute({ importId: IMPORT_ID, backup: envelope([song]) })).rejects.toMatchObject({
      code: "import-id-conflict",
    });
    expect(state.inserted).toHaveLength(1);
  });

  it("outra importação para a conta já preenchida é conflito", async () => {
    const { service } = createFakeStore();
    await service.execute({ importId: IMPORT_ID, backup });

    await expect(service.execute({ importId: OTHER_IMPORT_ID, backup })).rejects.toMatchObject({
      code: "remote-library-not-empty",
    });
  });
});

describe("status", () => {
  it("devolve o resumo de uma importação concluída", async () => {
    const { service } = createFakeStore();
    const { summary } = await service.execute({ importId: IMPORT_ID, backup });

    await expect(service.status(IMPORT_ID)).resolves.toEqual({ status: "completed", ...summary });
  });

  it("não afirma sucesso nem falha quando não há resultado", async () => {
    const { service } = createFakeStore();

    const status = await service.status(IMPORT_ID);

    expect(status).toMatchObject({ status: "unknown", importId: IMPORT_ID });
    expect((status as { message: string }).message).toContain("não indica sucesso nem falha");
  });

  it("rejeita identificador malformado", async () => {
    const { service } = createFakeStore();
    await expect(service.status("nao-e-uuid")).rejects.toMatchObject({ code: "invalid-data" });
  });
});

describe("respostas de erro", () => {
  it.each([
    ["remote-library-not-empty", 409, "remote_library_not_empty"],
    ["import-id-conflict", 409, "import_id_conflict"],
    ["import-limit-exceeded", 413, "payload_too_large"],
    ["invalid-data", 400, "invalid_input"],
    ["persistence-failed", 503, "persistence_failed"],
  ] as const)("%s responde %d", async (code, status, publicCode) => {
    const response = toErrorResponse(new LibraryError(code));

    expect(response.status).toBe(status);
    expect((await response.json()).error.code).toBe(publicCode);
  });
});
