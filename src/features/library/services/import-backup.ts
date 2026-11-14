import { isRecord, parseJsonDocument } from "../data/library-storage";
import type { LibraryRecord } from "../domain/library";
import { parseLibraryBackupDocument } from "./library-backup";

export const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024;

export interface BackupPreview {
  library: LibraryRecord;
  schemaVersion: number;
  exportedAt: string | null;
}

export type BackupInspection =
  | { ok: true; preview: BackupPreview }
  | { ok: false; error: string };

function failure(error: string): BackupInspection {
  return { ok: false, error };
}

function isJsonFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".json") || file.type === "application/json";
}

/** Interpreta o conteúdo como dados não confiáveis. Nada é gravado aqui. */
export function inspectBackupText(text: string): BackupInspection {
  if (text.trim() === "") {
    return failure("O arquivo está vazio.");
  }

  const document = parseJsonDocument(text);
  if (document === undefined) {
    return failure("O arquivo não contém um JSON válido.");
  }

  return inspectBackupDocument(document);
}

/** Mesma validação usada pelo navegador e pelo servidor. */
export function inspectBackupDocument(document: unknown): BackupInspection {
  const result = parseLibraryBackupDocument(document);

  if (result.status === "newer-version") {
    return failure(
      "Este backup foi criado por uma versão mais recente do aplicativo e não pode ser importado.",
    );
  }

  if (result.status === "invalid") {
    return failure(`Este arquivo não é um backup válido. ${result.issue ?? "Há campos ausentes ou inválidos."}`);
  }

  // Um documento aceito sempre tem estes campos: a validação acima já os conferiu.
  const { schemaVersion, exportedAt } = isRecord(document) ? document : {};

  return {
    ok: true,
    preview: {
      library: result.library,
      schemaVersion: typeof schemaVersion === "number" ? schemaVersion : 0,
      exportedAt: typeof exportedAt === "string" ? exportedAt : null,
    },
  };
}

/** Confere tipo e tamanho antes de ler o conteúdo do arquivo. */
export async function inspectBackupFile(file: File): Promise<BackupInspection> {
  if (!isJsonFile(file)) {
    return failure("Selecione um arquivo de backup no formato .json.");
  }

  if (file.size === 0) {
    return failure("O arquivo está vazio.");
  }

  if (file.size > MAX_BACKUP_FILE_BYTES) {
    return failure("O arquivo ultrapassa o limite de 5 MB.");
  }

  try {
    return inspectBackupText(await file.text());
  } catch {
    return failure("Não foi possível ler o arquivo selecionado.");
  }
}
