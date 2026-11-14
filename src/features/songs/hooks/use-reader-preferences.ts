"use client";

import { useSyncExternalStore } from "react";

import { readerPreferencesStore } from "../data/reader-preferences-store";
import type { ReaderPreferences } from "../domain/reader-preferences";

export function useReaderPreferences(): ReaderPreferences {
  return useSyncExternalStore(
    readerPreferencesStore.subscribe,
    readerPreferencesStore.getSnapshot,
    readerPreferencesStore.getServerSnapshot,
  );
}
