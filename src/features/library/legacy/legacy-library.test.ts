import { describe, expect, it, vi } from "vitest";

import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import { demoSongs } from "@/features/songs/data/demo-songs";
import { createMemoryStorage } from "@/test/memory-storage";

import { LIBRARY_STORAGE_KEY } from "../data/library-storage";
import { readLegacyLibrary } from "./legacy-library";

const song = { ...demoSongs[0], id: "s-propria", title: "Minha", updatedAt: "2026-05-05T00:00:00.000Z" };

function stored(document: unknown): ReturnType<typeof createMemoryStorage> {
  return createMemoryStorage({ [LIBRARY_STORAGE_KEY]: JSON.stringify(document) });
}

describe("leitor da biblioteca antiga", () => {
  it("lê uma biblioteca antiga válida", () => {
    const storage = stored({ schemaVersion: 1, songs: [song], repertoires: [] });

    expect(readLegacyLibrary(() => storage)).toMatchObject({
      status: "ready",
      onlyExamples: false,
      library: { songs: [{ id: "s-propria" }] },
    });
  });

  it("não recria exemplos quando não há dados", () => {
    const storage = createMemoryStorage();

    expect(readLegacyLibrary(() => storage)).toEqual({ status: "none" });
    expect(storage.data.size).toBe(0);
  });

  it("nunca altera o que está guardado", () => {
    const storage = stored({ schemaVersion: 1, songs: [song], repertoires: [] });
    const setItem = vi.spyOn(storage, "getItem");
    const before = [...storage.data.entries()];

    readLegacyLibrary(() => storage);

    expect([...storage.data.entries()]).toEqual(before);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("trata um envelope vazio como ausência de dados", () => {
    expect(readLegacyLibrary(() => stored({ schemaVersion: 1, songs: [], repertoires: [] }))).toEqual({
      status: "none",
    });
  });

  it("identifica uma biblioteca só com os exemplos antigos", () => {
    const storage = stored({ schemaVersion: 1, songs: demoSongs, repertoires: demoRepertoires });

    expect(readLegacyLibrary(() => storage)).toMatchObject({ status: "ready", onlyExamples: true });
  });

  it("um exemplo editado passa a ser conteúdo do usuário", () => {
    const edited = demoSongs.map((entry, index) =>
      index === 0 ? { ...entry, updatedAt: "2026-05-05T00:00:00.000Z" } : entry,
    );
    const storage = stored({ schemaVersion: 1, songs: edited, repertoires: demoRepertoires });

    expect(readLegacyLibrary(() => storage)).toMatchObject({ status: "ready", onlyExamples: false });
  });

  it("preserva o conteúdo original de dados danificados", () => {
    const storage = createMemoryStorage({ [LIBRARY_STORAGE_KEY]: "{ quebrado" });

    expect(readLegacyLibrary(() => storage)).toEqual({
      status: "blocked",
      reason: "invalid",
      rawData: "{ quebrado",
    });
    expect(storage.data.get(LIBRARY_STORAGE_KEY)).toBe("{ quebrado");
  });

  it("identifica dados de uma versão mais nova", () => {
    const raw = JSON.stringify({ schemaVersion: 99 });
    const storage = createMemoryStorage({ [LIBRARY_STORAGE_KEY]: raw });

    expect(readLegacyLibrary(() => storage)).toEqual({
      status: "blocked",
      reason: "newer-version",
      rawData: raw,
    });
  });

  it("informa quando o armazenamento está bloqueado", () => {
    expect(
      readLegacyLibrary(() => {
        throw new DOMException("bloqueado", "SecurityError");
      }),
    ).toEqual({ status: "unavailable" });
  });
});
