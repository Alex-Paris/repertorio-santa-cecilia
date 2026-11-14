import { z } from "zod";

import type { RepertoireRepository } from "@/features/repertoires/data/repertoire-repository";
import type { SongRepository } from "@/features/songs/data/song-repository";

import { IMPORT_LIMITS, MAX_IMPORT_BODY_BYTES } from "../domain/import-limits";
import type { LibraryRecord } from "../domain/library";
import { getLibraryErrorMessage, LibraryError } from "../domain/library-errors";
import { inspectBackupDocument } from "../services/import-backup";
import { createLibraryBackup, type LibraryBackup } from "../services/library-backup";
import type { LibraryApi } from "../data/remote/library-api";
import {
  fingerprintLibrary,
  type MigrationAttempt,
  type MigrationAttemptStore,
} from "./migration-attempts";

const IMPORT_TIMEOUT_MS = 120_000;

const LOCAL_STATUS_MESSAGES = {
  none: "Não encontramos uma biblioteca antiga neste navegador.",
  blocked:
    "A biblioteca antiga deste navegador está danificada ou tem um formato desconhecido. Nada foi alterado. Baixe os dados originais para guardá-los.",
  unavailable: "O armazenamento deste navegador não está disponível.",
} as const;

export interface LibraryCounts {
  songs: number;
  repertoires: number;
}

export type LocalLibraryState =
  | { status: "ready"; library: LibraryRecord }
  | { status: "none" }
  | { status: "unavailable" }
  | { status: "blocked" };

export type MigrationView =
  | { step: "checking" }
  | { step: "local-unavailable"; reason: "none" | "blocked" | "unavailable" | "invalid" | "too-large"; message: string }
  | { step: "ready"; local: LibraryCounts; remote: LibraryCounts }
  | { step: "conflict"; local: LibraryCounts; remote: LibraryCounts }
  | { step: "importing" }
  | { step: "verifying" }
  | { step: "uncertain"; canRepeat: boolean; statusChecked: boolean }
  | { step: "completed"; imported: LibraryCounts; remote: LibraryCounts | null; countsMatch: boolean }
  | { step: "session-expired" }
  | { step: "error"; message: string };

const previewResponse = z.object({
  preview: z.object({
    summary: z.object({ songs: z.number(), repertoires: z.number(), items: z.number() }),
    remote: z.object({ songs: z.number(), repertoires: z.number(), isEmpty: z.boolean() }),
    canImport: z.boolean(),
    conflicts: z.array(z.string()),
  }),
});

const importResponse = z.object({
  import: z.object({
    importId: z.string(),
    status: z.literal("completed"),
    songs: z.number(),
    repertoires: z.number(),
  }),
});

const statusResponse = z.object({
  import: z.discriminatedUnion("status", [
    z.object({ status: z.literal("completed"), songs: z.number(), repertoires: z.number() }),
    z.object({ status: z.literal("unknown") }),
  ]),
});

export interface MigrationFlowOptions {
  userId: string;
  api: LibraryApi;
  attempts: MigrationAttemptStore;
  remote: { songs: Pick<SongRepository, "list">; repertoires: Pick<RepertoireRepository, "list"> };
  getLocal: () => LocalLibraryState;
  /** Avisa que a biblioteca da conta mudou. */
  onRemoteChanged: () => void;
  createImportId?: () => string;
  now?: () => Date;
}

export interface MigrationFlow {
  begin(): Promise<MigrationView>;
  startImport(): Promise<MigrationView>;
  verify(): Promise<MigrationView>;
  repeat(): Promise<MigrationView>;
  discard(): Promise<MigrationView>;
}

type LocalSnapshot =
  | { ok: true; library: LibraryRecord; backup: LibraryBackup; counts: LibraryCounts }
  | { ok: false; view: MigrationView };

function isExpired(error: unknown): boolean {
  return (
    error instanceof LibraryError &&
    (error.code === "session-expired" || error.code === "session-changed")
  );
}

export function createMigrationFlow(options: MigrationFlowOptions): MigrationFlow {
  const {
    api,
    attempts,
    remote,
    getLocal,
    onRemoteChanged,
    userId,
    createImportId = () => crypto.randomUUID(),
    now = () => new Date(),
  } = options;

  /** Valida o conteúdo local antes de qualquer envio. */
  function buildSnapshot(): LocalSnapshot {
    const local = getLocal();

    if (local.status !== "ready") {
      return {
        ok: false,
        view: {
          step: "local-unavailable",
          reason: local.status,
          message: LOCAL_STATUS_MESSAGES[local.status],
        },
      };
    }

    const backup = createLibraryBackup(local.library, now());
    const text = JSON.stringify(backup);
    const inspection = inspectBackupDocument(JSON.parse(text));

    if (!inspection.ok) {
      return { ok: false, view: { step: "local-unavailable", reason: "invalid", message: inspection.error } };
    }

    const items = local.library.repertoires.reduce((total, r) => total + r.items.length, 0);

    if (
      local.library.songs.length > IMPORT_LIMITS.songs ||
      local.library.repertoires.length > IMPORT_LIMITS.repertoires ||
      items > IMPORT_LIMITS.items ||
      new TextEncoder().encode(text).length > MAX_IMPORT_BODY_BYTES
    ) {
      return {
        ok: false,
        view: {
          step: "local-unavailable",
          reason: "too-large",
          message: "Esta biblioteca excede os limites de importação.",
        },
      };
    }

    return {
      ok: true,
      library: local.library,
      backup,
      counts: { songs: local.library.songs.length, repertoires: local.library.repertoires.length },
    };
  }

  function toFailureView(error: unknown): MigrationView {
    return isExpired(error)
      ? { step: "session-expired" }
      : { step: "error", message: getLibraryErrorMessage(error) };
  }

  async function preview(): Promise<MigrationView> {
    const snapshot = buildSnapshot();
    if (!snapshot.ok) {
      return snapshot.view;
    }

    try {
      const { preview: result } = await api.request("/import/preview", previewResponse, {
        method: "POST",
        body: { backup: snapshot.backup },
        timeoutMs: IMPORT_TIMEOUT_MS,
      });

      const remoteCounts = { songs: result.remote.songs, repertoires: result.remote.repertoires };

      return result.canImport
        ? { step: "ready", local: snapshot.counts, remote: remoteCounts }
        : { step: "conflict", local: snapshot.counts, remote: remoteCounts };
    } catch (error) {
      return toFailureView(error);
    }
  }

  /** Confere o que está de fato na conta. A importação já está confirmada a esta altura. */
  async function finish(attempt: MigrationAttempt, imported: LibraryCounts): Promise<MigrationView> {
    if (attempt.status !== "completed") {
      try {
        attempts.save({ ...attempt, status: "completed" });
      } catch {
        // O resultado no servidor continua correto; só o registro local não foi atualizado.
      }
    }

    onRemoteChanged();

    try {
      const [songs, repertoires] = await Promise.all([remote.songs.list(), remote.repertoires.list()]);
      const counts = { songs: songs.length, repertoires: repertoires.length };

      return {
        step: "completed",
        imported,
        remote: counts,
        countsMatch: counts.songs === imported.songs && counts.repertoires === imported.repertoires,
      };
    } catch {
      return { step: "completed", imported, remote: null, countsMatch: false };
    }
  }

  function canRepeat(attempt: MigrationAttempt): boolean {
    const local = getLocal();
    return local.status === "ready" && fingerprintLibrary(local.library) === attempt.fingerprint;
  }

  /** Nunca conclui falha a partir de um erro: pergunta ao servidor o que aconteceu. */
  async function verifyAttempt(attempt: MigrationAttempt): Promise<MigrationView> {
    try {
      const { import: status } = await api.request(`/imports/${attempt.importId}`, statusResponse);

      if (status.status === "completed") {
        return await finish(attempt, { songs: status.songs, repertoires: status.repertoires });
      }
      return { step: "uncertain", canRepeat: canRepeat(attempt), statusChecked: true };
    } catch (error) {
      if (isExpired(error)) {
        return { step: "session-expired" };
      }
      return { step: "uncertain", canRepeat: canRepeat(attempt), statusChecked: false };
    }
  }

  async function send(attempt: MigrationAttempt, backup: LibraryBackup): Promise<MigrationView> {
    try {
      const { import: result } = await api.request("/import", importResponse, {
        method: "POST",
        body: { importId: attempt.importId, backup },
        timeoutMs: IMPORT_TIMEOUT_MS,
      });

      return await finish(attempt, { songs: result.songs, repertoires: result.repertoires });
    } catch (error) {
      if (error instanceof LibraryError) {
        if (isExpired(error)) {
          return { step: "session-expired" };
        }

        // Respostas definitivas do servidor: esta tentativa não importou nada.
        if (error.code === "remote-library-not-empty") {
          attempts.clear();
          return preview();
        }
        if (
          error.code === "import-id-conflict" ||
          error.code === "invalid-data" ||
          error.code === "import-limit-exceeded" ||
          error.code === "forbidden"
        ) {
          attempts.clear();
          return { step: "error", message: error.message };
        }
      }

      // Rede, tempo esgotado ou 503: o servidor pode ter concluído. Um 503 não prova rollback.
      return verifyAttempt(attempt);
    }
  }

  return {
    async begin() {
      const attempt = attempts.load();
      return attempt ? verifyAttempt(attempt) : preview();
    },

    async startImport() {
      const snapshot = buildSnapshot();
      if (!snapshot.ok) {
        return snapshot.view;
      }

      const attempt: MigrationAttempt = {
        userId,
        importId: createImportId(),
        fingerprint: fingerprintLibrary(snapshot.library),
        status: "pending",
        startedAt: now().toISOString(),
      };

      try {
        // Registrado antes do envio: um recarregamento ainda encontra esta tentativa.
        attempts.save(attempt);
      } catch (error) {
        return toFailureView(error);
      }

      return send(attempt, snapshot.backup);
    },

    async verify() {
      const attempt = attempts.load();
      return attempt ? verifyAttempt(attempt) : preview();
    },

    async repeat() {
      const attempt = attempts.load();
      if (!attempt) {
        return preview();
      }

      // O mesmo importId só pode acompanhar o mesmo conteúdo.
      const snapshot = buildSnapshot();
      if (!snapshot.ok) {
        return snapshot.view;
      }
      if (fingerprintLibrary(snapshot.library) !== attempt.fingerprint) {
        return { step: "uncertain", canRepeat: false, statusChecked: true };
      }

      return send(attempt, snapshot.backup);
    },

    async discard() {
      attempts.clear();
      return preview();
    },
  };
}
