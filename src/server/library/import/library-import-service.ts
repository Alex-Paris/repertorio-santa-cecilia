import "server-only";

import type { LibraryRecord } from "@/features/library/domain/library";
import { LibraryError } from "@/features/library/domain/library-errors";

import {
  importIdSchema,
  validateBackup,
  type BackupCounts,
  type ImportPreviewRequest,
  type ImportRequest,
} from "./import-validation";

export interface LibraryImportRecord extends BackupCounts {
  importId: string;
  contentHash: string;
  schemaVersion: number;
  completedAt: Date;
}

/** Operações que precisam acontecer juntas, na mesma transação. */
export interface LibraryImportTransaction {
  findRecord(importId: string): Promise<LibraryImportRecord | null>;
  /** Disputa o estado do usuário, para serializar importações e criações concorrentes. */
  reserveLibrary(): Promise<void>;
  isLibraryEmpty(): Promise<boolean>;
  insertLibrary(library: LibraryRecord): Promise<void>;
  saveRecord(record: LibraryImportRecord): Promise<void>;
}

/** Persistência de um usuário. O proprietário é definido ao criar a implementação. */
export interface LibraryImportStore {
  transaction<T>(work: (transaction: LibraryImportTransaction) => Promise<T>): Promise<T>;
  findRecord(importId: string): Promise<LibraryImportRecord | null>;
  countRemote(): Promise<{ songs: number; repertoires: number }>;
}

export interface ImportSummary extends BackupCounts {
  importId: string;
  schemaVersion: number;
  completedAt: string;
}

export interface ImportExecution {
  summary: ImportSummary;
  /** Verdadeiro quando a resposta veio de uma importação já concluída. */
  replayed: boolean;
}

export type ImportConflict =
  | "remote_library_not_empty"
  | "import_id_conflict"
  | "already_imported";

export interface ImportPreview {
  summary: BackupCounts & { schemaVersion: number; exportedAt: string | null };
  remote: { songs: number; repertoires: number; isEmpty: boolean };
  canImport: boolean;
  conflicts: ImportConflict[];
}

export type ImportStatus =
  | ({ status: "completed" } & ImportSummary)
  | { status: "unknown"; importId: string; message: string };

export interface LibraryImportService {
  preview(request: ImportPreviewRequest): Promise<ImportPreview>;
  execute(request: ImportRequest): Promise<ImportExecution>;
  status(importId: string): Promise<ImportStatus>;
}

const UNKNOWN_RESULT_MESSAGE =
  "Não há resultado confirmado para esta importação. Isso não indica sucesso nem falha.";

function toSummary(record: LibraryImportRecord): ImportSummary {
  const { importId, schemaVersion, songs, repertoires, items, completedAt } = record;
  return {
    importId,
    schemaVersion,
    songs,
    repertoires,
    items,
    completedAt: completedAt.toISOString(),
  };
}

export function createLibraryImportService(store: LibraryImportStore): LibraryImportService {
  return {
    async preview({ importId, backup }) {
      const { counts, schemaVersion, exportedAt, contentHash } = validateBackup(backup);
      const remote = await store.countRemote();
      const isEmpty = remote.songs === 0 && remote.repertoires === 0;
      const record = importId ? await store.findRecord(importId) : null;

      const conflicts: ImportConflict[] = [];
      if (record) {
        conflicts.push(record.contentHash === contentHash ? "already_imported" : "import_id_conflict");
      }
      if (!isEmpty) {
        conflicts.push("remote_library_not_empty");
      }

      return {
        summary: { ...counts, schemaVersion, exportedAt },
        remote: { ...remote, isEmpty },
        canImport: conflicts.length === 0,
        conflicts,
      };
    },

    async execute({ importId, backup }) {
      // Valida antes de abrir a transação, e o trabalho pode rodar de novo em caso de conflito.
      const { library, schemaVersion, counts, contentHash } = validateBackup(backup);

      return store.transaction(async (transaction) => {
        const existing = await transaction.findRecord(importId);

        if (existing) {
          if (existing.contentHash !== contentHash) {
            throw new LibraryError("import-id-conflict");
          }
          return { summary: toSummary(existing), replayed: true };
        }

        await transaction.reserveLibrary();

        if (!(await transaction.isLibraryEmpty())) {
          throw new LibraryError("remote-library-not-empty");
        }

        const record: LibraryImportRecord = {
          importId,
          contentHash,
          schemaVersion,
          ...counts,
          completedAt: new Date(),
        };

        await transaction.insertLibrary(library);
        await transaction.saveRecord(record);

        return { summary: toSummary(record), replayed: false };
      });
    },

    async status(importId) {
      if (!importIdSchema.safeParse(importId).success) {
        throw new LibraryError("invalid-data", "Identificador de importação inválido.");
      }

      const record = await store.findRecord(importId);
      return record
        ? { status: "completed", ...toSummary(record) }
        : { status: "unknown", importId, message: UNKNOWN_RESULT_MESSAGE };
    },
  };
}
