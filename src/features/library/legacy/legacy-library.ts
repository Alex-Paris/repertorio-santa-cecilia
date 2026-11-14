import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import { demoSongs } from "@/features/songs/data/demo-songs";

import { LIBRARY_STORAGE_KEY, readStoredLibrary, type StorageProvider } from "../data/library-storage";
import { LibraryError } from "../domain/library-errors";
import type { LibraryRecord } from "../domain/library";

/**
 * Biblioteca de instalações antigas, guardada neste navegador. Somente leitura: nada neste
 * módulo grava, recria exemplos ou remove a chave, e os dados não têm dono confiável.
 */
export type LegacyLibrary =
  | { status: "none" }
  | { status: "unavailable" }
  | { status: "ready"; library: LibraryRecord; onlyExamples: boolean }
  | { status: "blocked"; reason: "invalid" | "newer-version"; rawData: string };

function matchesDemo(
  entries: readonly { id: string; updatedAt: string }[],
  demo: readonly { id: string; updatedAt: string }[],
): boolean {
  const updatedAtById = new Map(demo.map((entry) => [entry.id, entry.updatedAt]));
  return (
    entries.length === demo.length &&
    entries.every((entry) => updatedAtById.get(entry.id) === entry.updatedAt)
  );
}

/** Versões antigas criavam exemplos no primeiro acesso: isso não é conteúdo do usuário. */
function isOnlyExamples(library: LibraryRecord): boolean {
  return matchesDemo(library.songs, demoSongs) && matchesDemo(library.repertoires, demoRepertoires);
}

export function readLegacyLibrary(getStorage: StorageProvider): LegacyLibrary {
  const stored = readStoredLibrary(getStorage);

  switch (stored.status) {
    case "empty":
      return { status: "none" };
    case "unavailable":
      return { status: "unavailable" };
    case "invalid":
    case "newer-version":
      return { status: "blocked", reason: stored.status, rawData: stored.raw };
    case "ok":
      return stored.library.songs.length === 0 && stored.library.repertoires.length === 0
        ? { status: "none" }
        : { status: "ready", library: stored.library, onlyExamples: isOnlyExamples(stored.library) };
  }
}

export function readBrowserLegacyLibrary(): LegacyLibrary {
  return readLegacyLibrary(() => window.localStorage);
}

/**
 * Apaga somente a chave da biblioteca antiga. Não usa `localStorage.clear()`: preferências,
 * sessão e dados de outros aplicativos ficam como estão. Funciona com dados danificados.
 */
export function deleteLegacyLibrary(
  getStorage: () => Pick<Storage, "getItem" | "removeItem">,
): void {
  try {
    const storage = getStorage();
    storage.removeItem(LIBRARY_STORAGE_KEY);
    if (storage.getItem(LIBRARY_STORAGE_KEY) !== null) {
      throw new Error("a chave continua presente");
    }
  } catch {
    throw new LibraryError(
      "storage-unavailable",
      "Não foi possível apagar a biblioteca antiga deste navegador. Nada foi alterado na sua conta.",
    );
  }
  notifyLegacyChange();
}

const legacyListeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedLegacy: LegacyLibrary = { status: "unavailable" };

function notifyLegacyChange(): void {
  legacyListeners.forEach((listener) => listener());
}

function handleStorage(event: StorageEvent): void {
  // `key` nulo: outra aba limpou todo o armazenamento.
  if (event.key === null || event.key === LIBRARY_STORAGE_KEY) {
    notifyLegacyChange();
  }
}

/** Assinatura reativa, inclusive para alterações feitas em outra aba (evento `storage`). */
export function subscribeLegacyLibrary(listener: () => void): () => void {
  if (legacyListeners.size === 0) {
    window.addEventListener("storage", handleStorage);
  }
  legacyListeners.add(listener);
  return () => {
    legacyListeners.delete(listener);
    if (legacyListeners.size === 0) {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

/** Mesma referência enquanto o conteúdo guardado não mudar. */
export function getLegacyLibrarySnapshot(): LegacyLibrary {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedLegacy = readBrowserLegacyLibrary();
  }
  return cachedLegacy;
}

const SERVER_SNAPSHOT: LegacyLibrary = { status: "unavailable" };

export function getServerLegacyLibrarySnapshot(): LegacyLibrary {
  return SERVER_SNAPSHOT;
}
