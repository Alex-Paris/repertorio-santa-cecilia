import { describe, expect, it, vi } from "vitest";

import { LIBRARY_STORAGE_KEY } from "@/features/library/data/library-storage";
import { createMemoryStorage } from "@/test/memory-storage";

import {
  clampFontSize,
  clampScrollSpeed,
  DEFAULT_READER_PREFERENCES,
  parseReaderPreferences,
} from "../domain/reader-preferences";
import { createReaderPreferencesStore, READER_PREFERENCES_KEY } from "./reader-preferences-store";

function storeWith(raw?: string) {
  const storage = createMemoryStorage(raw === undefined ? {} : { [READER_PREFERENCES_KEY]: raw });
  return { storage, store: createReaderPreferencesStore(() => storage) };
}

describe("parseReaderPreferences", () => {
  it("aceita valores válidos", () => {
    expect(parseReaderPreferences({ fontSize: 24, scrollSpeed: 50 })).toEqual({
      fontSize: 24,
      scrollSpeed: 50,
      // Preferências salvas antes da Etapa 2F.2 não têm estes campos: valem os padrões.
      readingMode: "chords",
      presentationTheme: "light",
    });
    expect(
      parseReaderPreferences({ fontSize: 24, scrollSpeed: 50, readingMode: "lyrics", presentationTheme: "dark" }),
    ).toMatchObject({ readingMode: "lyrics", presentationTheme: "dark" });
    expect(parseReaderPreferences({ readingMode: "karaoke", presentationTheme: "neon" })).toEqual(DEFAULT_READER_PREFERENCES);
  });

  it.each([null, "x", 3, [], undefined])("usa os padrões para %j", (value) => {
    expect(parseReaderPreferences(value)).toEqual(DEFAULT_READER_PREFERENCES);
  });

  it.each([
    [{ fontSize: 8, scrollSpeed: 50 }, { fontSize: 18, scrollSpeed: 50 }],
    [{ fontSize: 31, scrollSpeed: 50 }, { fontSize: 18, scrollSpeed: 50 }],
    [{ fontSize: 15, scrollSpeed: 50 }, { fontSize: 18, scrollSpeed: 50 }],
    [{ fontSize: "24", scrollSpeed: 50 }, { fontSize: 18, scrollSpeed: 50 }],
    [{ fontSize: 24, scrollSpeed: 500 }, { fontSize: 24, scrollSpeed: 30 }],
    [{ fontSize: 24 }, { fontSize: 24, scrollSpeed: 30 }],
  ])("recupera campo a campo %j", (value, expected) => {
    expect(parseReaderPreferences(value)).toEqual({ ...expected, readingMode: "chords", presentationTheme: "light" });
  });

  it("limita os valores às faixas permitidas", () => {
    expect(clampFontSize(40)).toBe(30);
    expect(clampFontSize(2)).toBe(14);
    expect(clampScrollSpeed(100)).toBe(80);
    expect(clampScrollSpeed(1)).toBe(10);
  });
});

describe("armazenamento das preferências", () => {
  it("começa com os padrões no servidor, sem tocar no armazenamento", () => {
    const getStorage = vi.fn(() => createMemoryStorage());
    expect(createReaderPreferencesStore(getStorage).getServerSnapshot()).toEqual(
      DEFAULT_READER_PREFERENCES,
    );
    expect(getStorage).not.toHaveBeenCalled();
  });

  it("usa chave própria e versionada, sem tocar na biblioteca", () => {
    const { store, storage } = storeWith();
    storage.setItem(LIBRARY_STORAGE_KEY, "biblioteca intacta");

    store.update({ fontSize: 24 });

    expect(READER_PREFERENCES_KEY).toBe("repertorio.reader.preferences.v1");
    expect(storage.data.get(LIBRARY_STORAGE_KEY)).toBe("biblioteca intacta");
    expect(JSON.parse(storage.data.get(READER_PREFERENCES_KEY) ?? "")).toEqual({
      fontSize: 24,
      scrollSpeed: 30,
      readingMode: "chords",
      presentationTheme: "light",
    });
  });

  it("recupera o que foi salvo em uma nova sessão", () => {
    const { store, storage } = storeWith();
    store.update({ fontSize: 26, scrollSpeed: 60, readingMode: "lyrics" });

    expect(createReaderPreferencesStore(() => storage).getSnapshot()).toEqual({
      fontSize: 26,
      scrollSpeed: 60,
      readingMode: "lyrics",
      presentationTheme: "light",
    });
  });

  it.each(["{ quebrado", "[]", '{"fontSize":999}'])("usa padrões com dados inválidos: %s", (raw) => {
    const { store, storage } = storeWith(raw);

    expect(store.getSnapshot()).toEqual(DEFAULT_READER_PREFERENCES);
    expect(storage.data.get(READER_PREFERENCES_KEY)).toBe(raw);
  });

  it("mantém a referência enquanto nada muda", () => {
    const { store } = storeWith('{"fontSize":20,"scrollSpeed":40}');
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("continua funcionando na sessão com armazenamento indisponível", () => {
    const store = createReaderPreferencesStore(() => {
      throw new DOMException("negado", "SecurityError");
    });

    store.update({ fontSize: 28 });

    expect(store.getSnapshot().fontSize).toBe(28);
  });

  it("sincroniza quando outra aba altera a preferência", () => {
    const { store, storage } = storeWith();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    storage.setItem(READER_PREFERENCES_KEY, '{"fontSize":22,"scrollSpeed":30}');
    window.dispatchEvent(new StorageEvent("storage", { key: READER_PREFERENCES_KEY }));

    expect(listener).toHaveBeenCalled();
    expect(store.getSnapshot().fontSize).toBe(22);
    unsubscribe();
  });
});
