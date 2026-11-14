import "server-only";

import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { z } from "zod";

import { isRecord, migrateLibraryDocument } from "@/features/library/data/library-storage";
import { IMPORT_LIMITS, MAX_IMPORT_BODY_BYTES } from "@/features/library/domain/import-limits";
import type { LibraryRecord } from "@/features/library/domain/library";
import { LibraryError } from "@/features/library/domain/library-errors";
import { inspectBackupDocument } from "@/features/library/services/import-backup";

export { IMPORT_LIMITS, MAX_IMPORT_BODY_BYTES };

export const importIdSchema = z.uuid();

export const importRequestSchema = z.strictObject({
  importId: importIdSchema,
  backup: z.unknown(),
});

export const importPreviewRequestSchema = z.strictObject({
  importId: importIdSchema.optional(),
  backup: z.unknown(),
});

export type ImportRequest = z.infer<typeof importRequestSchema>;
export type ImportPreviewRequest = z.infer<typeof importPreviewRequestSchema>;

export interface BackupCounts {
  songs: number;
  repertoires: number;
  items: number;
}

export interface ValidatedBackup {
  library: LibraryRecord;
  schemaVersion: number;
  exportedAt: string | null;
  counts: BackupCounts;
  contentHash: string;
}

function invalid(message: string): LibraryError {
  return new LibraryError("invalid-data", message);
}

/** Barato e feito antes da validação completa, para não processar listas desproporcionais. */
function assertWithinCountLimits(document: unknown): void {
  if (!isRecord(document)) {
    return;
  }

  const { songs, repertoires } = document;
  const items = Array.isArray(repertoires)
    ? repertoires.reduce<number>(
        (total, repertoire: unknown) =>
          total + (isRecord(repertoire) && Array.isArray(repertoire.items) ? repertoire.items.length : 0),
        0,
      )
    : 0;

  if (
    (Array.isArray(songs) && songs.length > IMPORT_LIMITS.songs) ||
    (Array.isArray(repertoires) && repertoires.length > IMPORT_LIMITS.repertoires) ||
    items > IMPORT_LIMITS.items
  ) {
    throw new LibraryError("import-limit-exceeded");
  }
}

function assertUniquePositions(library: LibraryRecord): void {
  for (const repertoire of library.repertoires) {
    const positions = repertoire.items.map((item) => item.position);
    if (new Set(positions).size !== positions.length) {
      throw invalid("Este arquivo não é um backup válido. Há posições repetidas em um repertório.");
    }
  }
}

/** Os esquemas removem espaços das pontas; na importação, isso seria uma correção silenciosa. */
function assertUnchangedByValidation(document: unknown, library: LibraryRecord): void {
  // Compara com o documento já convertido à versão atual: a migração só acrescenta a origem.
  const migrated = isRecord(document) ? migrateLibraryDocument(document) : undefined;
  if (
    migrated &&
    !isDeepStrictEqual({ songs: migrated.songs, repertoires: migrated.repertoires }, library)
  ) {
    throw invalid("Este arquivo não é um backup válido. Há campos fora do formato esperado.");
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        // A origem "personal" é implícita na versão 1: o mesmo conteúdo mantém o mesmo hash.
        .filter((key) => !(key === "source" && value[key] === "personal"))
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

/** Identifica o conteúdo independentemente da ordem das chaves e de `exportedAt`. */
export function hashLibrary(library: LibraryRecord): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(library))).digest("hex");
}

/** Validação completa, a mesma do navegador, mais as regras próprias da importação. */
export function validateBackup(document: unknown): ValidatedBackup {
  assertWithinCountLimits(document);

  const inspection = inspectBackupDocument(document);
  if (!inspection.ok) {
    throw invalid(inspection.error);
  }

  const { library, schemaVersion, exportedAt } = inspection.preview;
  assertUniquePositions(library);
  assertUnchangedByValidation(document, library);

  return {
    library,
    schemaVersion,
    exportedAt,
    counts: {
      songs: library.songs.length,
      repertoires: library.repertoires.length,
      items: library.repertoires.reduce((total, repertoire) => total + repertoire.items.length, 0),
    },
    contentHash: hashLibrary(library),
  };
}
