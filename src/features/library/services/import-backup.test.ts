import { describe, expect, it } from "vitest";

import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import { demoSongs } from "@/features/songs/data/demo-songs";

import {
  inspectBackupFile,
  inspectBackupText,
  MAX_BACKUP_FILE_BYTES,
} from "./import-backup";
import { createLibraryBackup, serializeLibraryBackup } from "./library-backup";

const library = { songs: demoSongs, repertoires: demoRepertoires };
const exportedAt = new Date("2026-11-08T12:00:00.000Z");
const validText = serializeLibraryBackup(createLibraryBackup(library, exportedAt));

const song = {
  id: "s1",
  title: "Teste",
  artist: "Artista",
  originalKey: "G",
  contentType: "original",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function documentWith(songs: unknown[], repertoires: unknown[] = []): string {
  return JSON.stringify({ schemaVersion: 1, songs, repertoires });
}

function expectFailure(text: string, message: string | RegExp): void {
  const result = inspectBackupText(text);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toMatch(message);
  }
}

describe("inspectBackupText", () => {
  it("aceita um backup válido e resume seu conteúdo", () => {
    const result = inspectBackupText(validText);

    expect(result).toEqual({
      ok: true,
      preview: { library, schemaVersion: 1, exportedAt: exportedAt.toISOString() },
    });
  });

  it("aceita arquivo sem exportedAt", () => {
    const result = inspectBackupText(documentWith([song]));

    expect(result.ok && result.preview.exportedAt).toBeNull();
    expect(result.ok && result.preview.library.songs).toHaveLength(1);
  });

  it("não interpreta exportedAt como dado da biblioteca", () => {
    const result = inspectBackupText(validText);
    expect(result.ok && result.preview.library).not.toHaveProperty("exportedAt");
  });

  it.each(["", "   \n "])("rejeita conteúdo vazio %j", (text) => {
    expectFailure(text, "O arquivo está vazio.");
  });

  it.each(["{ quebrado", "não é json", "{'a':1}"])("rejeita JSON malformado: %s", (text) => {
    expectFailure(text, "O arquivo não contém um JSON válido.");
  });

  it.each(["[]", "null", "123", '"texto"', "{}"])("rejeita documento sem o formato: %s", (text) => {
    expectFailure(text, /não é um backup válido/);
  });

  it("rejeita versão mais recente", () => {
    expectFailure(JSON.stringify({ schemaVersion: 99, songs: [], repertoires: [] }), /versão mais recente/);
  });

  it("rejeita versão antiga sem migração", () => {
    expectFailure(JSON.stringify({ schemaVersion: 0, songs: [], repertoires: [] }), /versão deste arquivo não é suportada/);
  });

  it("rejeita exportedAt inválido", () => {
    expectFailure(
      JSON.stringify({ schemaVersion: 1, exportedAt: "ontem", songs: [], repertoires: [] }),
      /não é um backup válido/,
    );
  });

  it("rejeita IDs duplicados", () => {
    expectFailure(documentWith([song, song]), /mesmo ID/);
  });

  it("rejeita referência para música ausente", () => {
    expectFailure(
      documentWith(
        [song],
        [
          {
            id: "r1",
            name: "R",
            description: "",
            createdAt: song.createdAt,
            updatedAt: song.updatedAt,
            items: [{ id: "i1", songId: "fantasma", position: 1, transposeSemitones: 0 }],
          },
        ],
      ),
      /músicas inexistentes/,
    );
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "ftp://a.com", "exemplo"])(
    "rejeita URL externa %s",
    (sourceUrl) => {
      expectFailure(
        documentWith([{ ...song, contentType: "external-link", sourceUrl }]),
        /http:\/\/ ou https:\/\//,
      );
    },
  );

  it.each([
    ["campo desconhecido", { ...song, script: "alert(1)" }],
    ["tom inválido", { ...song, originalKey: "<b>" }],
    ["título gigante", { ...song, title: "x".repeat(301) }],
    ["cifra gigante", { ...song, chordPro: "x".repeat(100_001) }],
    ["ID gigante", { ...song, id: "x".repeat(129) }],
  ])("rejeita música com %s", (_name, invalidSong) => {
    expectFailure(documentWith([invalidSong]), /não é um backup válido/);
  });

  it("rejeita repertório com tom fora da faixa", () => {
    expectFailure(
      documentWith(
        [song],
        [
          {
            id: "r1",
            name: "R",
            description: "",
            createdAt: song.createdAt,
            updatedAt: song.updatedAt,
            items: [{ id: "i1", songId: "s1", position: 1, transposeSemitones: 50 }],
          },
        ],
      ),
      /não é um backup válido/,
    );
  });

  it("não polui o protótipo com chaves maliciosas", () => {
    const text = '{"schemaVersion":1,"songs":[],"repertoires":[],"__proto__":{"poluido":true}}';

    expectFailure(text, /não é um backup válido/);
    expect(({} as Record<string, unknown>).poluido).toBeUndefined();
  });

  it("guarda conteúdo com marcação como texto comum", () => {
    const result = inspectBackupText(
      documentWith([{ ...song, title: "<img src=x onerror=alert(1)>" }]),
    );
    expect(result.ok && result.preview.library.songs[0].title).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("inspectBackupFile", () => {
  it("aceita arquivo .json válido", async () => {
    const result = await inspectBackupFile(new File([validText], "backup.json"));
    expect(result.ok).toBe(true);
  });

  it("aceita extensão em maiúsculas e tipo JSON", async () => {
    expect((await inspectBackupFile(new File([validText], "BACKUP.JSON"))).ok).toBe(true);
    expect(
      (await inspectBackupFile(new File([validText], "backup", { type: "application/json" }))).ok,
    ).toBe(true);
  });

  it("rejeita outros tipos de arquivo sem ler o conteúdo", async () => {
    expect(await inspectBackupFile(new File([validText], "foto.png", { type: "image/png" }))).toEqual({
      ok: false,
      error: "Selecione um arquivo de backup no formato .json.",
    });
  });

  it("rejeita arquivo vazio", async () => {
    expect(await inspectBackupFile(new File([], "backup.json"))).toEqual({
      ok: false,
      error: "O arquivo está vazio.",
    });
  });

  it("rejeita arquivo excessivamente grande", async () => {
    const big = new File([new Uint8Array(MAX_BACKUP_FILE_BYTES + 1)], "backup.json");
    expect(await inspectBackupFile(big)).toEqual({
      ok: false,
      error: "O arquivo ultrapassa o limite de 5 MB.",
    });
  });

  it("trata falha na leitura do arquivo", async () => {
    const file = new File(["{}"], "backup.json");
    file.text = () => Promise.reject(new Error("falhou"));

    expect(await inspectBackupFile(file)).toEqual({
      ok: false,
      error: "Não foi possível ler o arquivo selecionado.",
    });
  });
});
