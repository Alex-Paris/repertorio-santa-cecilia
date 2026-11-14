"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { accountLibrary } from "../data/browser-library";
import {
  createHttpRepertoireRepository,
  createHttpSongRepository,
} from "../data/remote/http-repositories";
import { createLibraryApi } from "../data/remote/library-api";
import type { LibraryRecord } from "../domain/library";
import {
  getLegacyLibrarySnapshot,
  getServerLegacyLibrarySnapshot,
  readBrowserLegacyLibrary,
  subscribeLegacyLibrary,
  type LegacyLibrary,
} from "../legacy/legacy-library";
import { createMigrationAttemptStore } from "../migration/migration-attempts";
import {
  createMigrationFlow,
  type LocalLibraryState,
  type MigrationFlow,
  type MigrationView,
} from "../migration/migration-flow";
import { inspectBackupFile } from "../services/import-backup";

function toLocalState(legacy: LegacyLibrary): LocalLibraryState {
  switch (legacy.status) {
    case "ready":
      return { status: "ready", library: legacy.library };
    case "none":
    case "unavailable":
    case "blocked":
      return { status: legacy.status };
  }
}

export interface LibraryMigration {
  view: MigrationView;
  legacy: LegacyLibrary;
  /** Biblioteca que será copiada, do navegador ou de um arquivo. */
  source: LibraryRecord | null;
  fromFile: boolean;
  fileError: string | null;
  chooseFile: (file: File) => void;
  startImport: () => void;
  verify: () => void;
  repeat: () => void;
  discard: () => void;
}

/** Os dados do navegador são relidos a cada passo, para detectar qualquer mudança no conteúdo. */
export function useLibraryMigration(userId: string): LibraryMigration {
  // Reage à exclusão nesta tela e a mudanças feitas em outra aba.
  const legacy = useSyncExternalStore(
    subscribeLegacyLibrary,
    getLegacyLibrarySnapshot,
    getServerLegacyLibrarySnapshot,
  );
  const [fileLibrary, setFileLibrary] = useState<LibraryRecord | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [view, setView] = useState<MigrationView>({ step: "checking" });

  const flow = useMemo<MigrationFlow>(() => {
    const api = createLibraryApi({ userId });
    return createMigrationFlow({
      userId,
      api,
      attempts: createMigrationAttemptStore(userId, () => window.localStorage),
      remote: { songs: createHttpSongRepository(api), repertoires: createHttpRepertoireRepository(api) },
      getLocal: () =>
        fileLibrary ? { status: "ready", library: fileLibrary } : toLocalState(readBrowserLegacyLibrary()),
      onRemoteChanged: () => void accountLibrary.retry(),
    });
  }, [userId, fileLibrary]);

  useEffect(() => {
    let active = true;
    void flow.begin().then((next) => {
      if (active) {
        setView(next);
      }
    });
    return () => {
      active = false;
    };
    // A biblioteca antiga mudou (aqui ou em outra aba): a prévia é refeita sobre o conteúdo atual.
  }, [flow, legacy]);

  function run(step: "importing" | "verifying" | "checking", action: () => Promise<MigrationView>): void {
    setView({ step });
    void action().then(setView);
  }

  function chooseFile(file: File): void {
    setFileError(null);
    void inspectBackupFile(file).then((inspection) => {
      if (inspection.ok) {
        setView({ step: "checking" });
        setFileLibrary(inspection.preview.library);
      } else {
        setFileError(inspection.error);
      }
    });
  }

  return {
    view,
    legacy,
    source: fileLibrary ?? (legacy.status === "ready" ? legacy.library : null),
    fromFile: fileLibrary !== null,
    fileError,
    chooseFile,
    startImport: () => run("importing", flow.startImport),
    verify: () => run("verifying", flow.verify),
    repeat: () => run("importing", flow.repeat),
    discard: () => run("checking", flow.discard),
  };
}
