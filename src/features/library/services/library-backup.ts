import {
  CURRENT_SCHEMA_VERSION,
  isRecord,
  parseJsonDocument,
  parseLibraryDocument,
  type LibraryParseResult,
} from "../data/library-storage";
import type { LibraryRecord } from "../domain/library";

/** Mesmo envelope do armazenamento, acrescido da data da exportação. */
export interface LibraryBackup extends LibraryRecord {
  schemaVersion: number;
  exportedAt: string;
}

/** A revisão é controle de edição da conta, não conteúdo: fica fora do backup. */
function withoutRevision<T extends object>(document: T): T {
  const record = { ...document };
  delete (record as { revision?: unknown }).revision;
  return record;
}

/** Na versão 1 a origem não existia. */
function withoutSource<T extends object>(item: T): T {
  const record = { ...item };
  delete (record as { source?: unknown }).source;
  return record;
}

/**
 * Aceita a biblioteca da conta ou um registro antigo. O arquivo usa a menor versão capaz de
 * guardar o conteúdo, para continuar legível por versões anteriores do aplicativo:
 * 1 sem músicas do catálogo; 2 com elas (origem de cada item); 3 quando algum repertório
 * tem dados de missa (celebração ou momento litúrgico de um item).
 */
export function createLibraryBackup(library: LibraryRecord, exportedAt: Date): LibraryBackup {
  const repertoires = library.repertoires.map(withoutRevision);
  const usesCatalog = repertoires.some((repertoire) =>
    repertoire.items.some((item) => item.source === "catalog"),
  );
  const usesMass = repertoires.some(
    (repertoire) => repertoire.mass !== undefined || repertoire.items.some((item) => item.moment !== undefined),
  );
  const keepsSource = usesCatalog || usesMass;

  return {
    schemaVersion: usesMass ? CURRENT_SCHEMA_VERSION : usesCatalog ? 2 : 1,
    exportedAt: exportedAt.toISOString(),
    songs: library.songs.map(withoutRevision),
    repertoires: keepsSource
      ? repertoires
      : repertoires.map((repertoire) => ({
          ...repertoire,
          // Na versão 1 a origem é implícita: todos os itens são particulares.
          items: repertoire.items.map(withoutSource),
        })) as LibraryBackup["repertoires"],
  };
}

export function serializeLibraryBackup(backup: LibraryBackup): string {
  return JSON.stringify(backup, null, 2);
}

export function getBackupFileName(exportedAt: Date): string {
  return `repertorio-backup-${exportedAt.toISOString().slice(0, 10)}.json`;
}

/** Valida um arquivo exportado pelo mesmo caminho dos dados salvos, incluindo migrações. */
export function parseLibraryBackup(text: string): LibraryParseResult {
  return parseLibraryBackupDocument(parseJsonDocument(text));
}

/** `exportedAt` é opcional, mas precisa ser uma data válida quando existir. */
export function parseLibraryBackupDocument(document: unknown): LibraryParseResult {
  if (
    !isRecord(document) ||
    (document.exportedAt !== undefined &&
      (typeof document.exportedAt !== "string" || Number.isNaN(Date.parse(document.exportedAt))))
  ) {
    return { status: "invalid" };
  }

  return parseLibraryDocument(
    Object.fromEntries(Object.entries(document).filter(([key]) => key !== "exportedAt")),
  );
}
