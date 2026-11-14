
import {
  DEFAULT_READER_PREFERENCES,
  parseReaderPreferences,
  type ReaderPreferences,
} from "../domain/reader-preferences";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type StorageProvider = () => StorageLike;

/** Separada da biblioteca: um problema aqui nunca afeta músicas e repertórios. */
export const READER_PREFERENCES_KEY = "repertorio.reader.preferences.v1";

export interface ReaderPreferencesStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ReaderPreferences;
  getServerSnapshot(): ReaderPreferences;
  update(changes: Partial<ReaderPreferences>): void;
}

function parseStored(raw: string | null): ReaderPreferences {
  if (raw === null) {
    return DEFAULT_READER_PREFERENCES;
  }
  try {
    return parseReaderPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_READER_PREFERENCES;
  }
}

export function createReaderPreferencesStore(
  getStorage: StorageProvider,
): ReaderPreferencesStore {
  const listeners = new Set<() => void>();
  let snapshot = DEFAULT_READER_PREFERENCES;
  let lastRaw: string | null = null;
  let loaded = false;

  /** Retorna verdadeiro quando o conteúdo salvo mudou desde a última leitura. */
  function syncFromStorage(): boolean {
    loaded = true;

    let raw: string | null;
    try {
      raw = getStorage().getItem(READER_PREFERENCES_KEY);
    } catch {
      return false;
    }

    if (raw === lastRaw) {
      return false;
    }

    lastRaw = raw;
    snapshot = parseStored(raw);
    return true;
  }

  function notify(): void {
    listeners.forEach((listener) => listener());
  }

  function handleStorageEvent(event: StorageEvent): void {
    if ((event.key === null || event.key === READER_PREFERENCES_KEY) && syncFromStorage()) {
      notify();
    }
  }

  return {
    subscribe(listener) {
      const isFirstListener = listeners.size === 0;
      listeners.add(listener);

      if (isFirstListener) {
        window.addEventListener("storage", handleStorageEvent);
        if (syncFromStorage()) {
          notify();
        }
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          window.removeEventListener("storage", handleStorageEvent);
        }
      };
    },

    getSnapshot() {
      if (!loaded) {
        syncFromStorage();
      }
      return snapshot;
    },

    getServerSnapshot: () => DEFAULT_READER_PREFERENCES,

    update(changes) {
      snapshot = { ...snapshot, ...changes };
      const raw = JSON.stringify(snapshot);
      lastRaw = raw;

      try {
        getStorage().setItem(READER_PREFERENCES_KEY, raw);
      } catch {
        // A preferência continua valendo nesta sessão, mesmo sem poder ser salva.
      }

      notify();
    },
  };
}

export const readerPreferencesStore = createReaderPreferencesStore(() => window.localStorage);
