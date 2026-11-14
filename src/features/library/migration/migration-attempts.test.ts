import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import { demoSongs } from "@/features/songs/data/demo-songs";

import { createMigrationAttemptStore, fingerprintLibrary, type MigrationAttempt } from "./migration-attempts";

const library = { songs: demoSongs, repertoires: demoRepertoires };

const attempt: MigrationAttempt = {
  userId: "a",
  importId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
  fingerprint: "abc",
  status: "pending",
  startedAt: "2026-11-08T12:00:00.000Z",
};

beforeEach(() => localStorage.clear());

describe("registro da tentativa de migração", () => {
  it("guarda só o mínimo, sem cópia da biblioteca nem credenciais", () => {
    createMigrationAttemptStore("a", () => localStorage).save(attempt);

    const raw = JSON.parse(localStorage.getItem("repertorio.migration.v1.a")!) as object;
    expect(Object.keys(raw).sort()).toEqual(["fingerprint", "importId", "startedAt", "status", "userId"]);
  });

  it("uma conta não enxerga a tentativa de outra", () => {
    createMigrationAttemptStore("a", () => localStorage).save(attempt);

    expect(createMigrationAttemptStore("b", () => localStorage).load()).toBeNull();
  });

  it("ignora um registro adulterado", () => {
    localStorage.setItem("repertorio.migration.v1.a", JSON.stringify({ ...attempt, importId: "x" }));
    expect(createMigrationAttemptStore("a", () => localStorage).load()).toBeNull();

    localStorage.setItem("repertorio.migration.v1.a", "{oops");
    expect(createMigrationAttemptStore("a", () => localStorage).load()).toBeNull();
  });

  it("não esconde a falha de gravação", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("cheio", "QuotaExceededError");
    });

    expect(() => createMigrationAttemptStore("a", () => localStorage).save(attempt)).toThrow(
      expect.objectContaining({ code: "quota-exceeded" }),
    );
  });
});

describe("identificação do conteúdo", () => {
  it("é estável para o mesmo conteúdo", () => {
    expect(fingerprintLibrary(library)).toBe(fingerprintLibrary(structuredClone(library)));
  });

  it("muda quando uma música muda", () => {
    const changed = structuredClone(library);
    changed.songs[0] = { ...changed.songs[0], title: `${changed.songs[0].title}!` };

    expect(fingerprintLibrary(changed)).not.toBe(fingerprintLibrary(library));
  });
});
