import { describe, expect, it } from "vitest";

import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import { demoSongs } from "@/features/songs/data/demo-songs";

import { CURRENT_SCHEMA_VERSION } from "../data/library-storage";
import {
  createLibraryBackup,
  getBackupFileName,
  parseLibraryBackup,
  serializeLibraryBackup,
} from "./library-backup";

const library = { songs: demoSongs, repertoires: demoRepertoires };
const exportedAt = new Date("2026-11-08T12:00:00.000Z");

describe("backup JSON", () => {
  const text = serializeLibraryBackup(createLibraryBackup(library, exportedAt));

  it("contém apenas versão, data, músicas e repertórios", () => {
    const parsed: unknown = JSON.parse(text);
    expect(Object.keys(parsed as object).sort()).toEqual([
      "exportedAt",
      "repertoires",
      "schemaVersion",
      "songs",
    ]);
    // Sem músicas do catálogo, o arquivo mantém a versão 1, que versões anteriores também leem.
    expect(parsed).toMatchObject({ schemaVersion: 1 });
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
  });

  it("gera arquivo que passa pela mesma validação dos dados salvos", () => {
    expect(parseLibraryBackup(text)).toEqual({ status: "ok", library });
  });

  it("rejeita arquivos adulterados ou que não são backups", () => {
    expect(parseLibraryBackup("não é json").status).toBe("invalid");
    expect(parseLibraryBackup(JSON.stringify({ songs: [] })).status).toBe("invalid");
    expect(
      parseLibraryBackup(text.replace(`"songs": [`, `"songs": [{ "id": "x" },`)).status,
    ).toBe("invalid");
  });

  it("nomeia o arquivo com a data da exportação", () => {
    expect(getBackupFileName(exportedAt)).toBe("repertorio-backup-2026-11-08.json");
  });
});

describe("revisões e backup", () => {
  it("a exportação da conta mantém o formato anterior, sem revisão", async () => {
    const { withRevisions } = await import("@/test/fakes/memory-library-store");
    const { createLibraryBackup, parseLibraryBackupDocument } = await import("./library-backup");
    const { demoRepertoires } = await import("@/features/repertoires/data/demo-repertoires");
    const { demoSongs } = await import("@/features/songs/data/demo-songs");
    const versioned = withRevisions({ songs: demoSongs, repertoires: demoRepertoires });

    const backup = createLibraryBackup(versioned, new Date("2026-11-10T00:00:00.000Z"));

    expect(backup.schemaVersion).toBe(1);
    expect(JSON.stringify(backup)).not.toContain("revision");
    expect(backup.songs).toEqual(demoSongs);
    expect(parseLibraryBackupDocument(JSON.parse(JSON.stringify(backup)))).toMatchObject({ status: "ok" });
  });

  it("backups antigos, sem revisão, continuam válidos", async () => {
    const { parseLibraryBackupDocument } = await import("./library-backup");
    const { demoRepertoires } = await import("@/features/repertoires/data/demo-repertoires");
    const { demoSongs } = await import("@/features/songs/data/demo-songs");

    expect(
      parseLibraryBackupDocument({ schemaVersion: 1, exportedAt: "2025-01-01T00:00:00.000Z", songs: demoSongs, repertoires: demoRepertoires }),
    ).toMatchObject({ status: "ok" });
  });
});
