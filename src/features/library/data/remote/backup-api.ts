import { z } from "zod";

import { LibraryError } from "../../domain/library-errors";
import { parseLibraryBackupDocument, type LibraryBackup } from "../../services/library-backup";
import { createLibraryApi, type FetchLike } from "./library-api";

const EXPORT_TIMEOUT_MS = 120_000;

const exportResponse = z.object({ backup: z.record(z.string(), z.unknown()) });

/** Pede ao servidor um retrato completo da conta: não depende do que está em memória. */
export async function fetchAccountBackup(userId: string, fetchImpl?: FetchLike): Promise<LibraryBackup> {
  const api = createLibraryApi({ userId, fetchImpl });
  const { backup } = await api.request("/export", exportResponse, { timeoutMs: EXPORT_TIMEOUT_MS });

  const parsed = parseLibraryBackupDocument(backup);
  if (parsed.status !== "ok" || typeof backup.exportedAt !== "string") {
    throw new LibraryError("invalid-response");
  }

  return {
    schemaVersion: backup.schemaVersion as number,
    exportedAt: backup.exportedAt,
    songs: parsed.library.songs,
    repertoires: parsed.library.repertoires,
  };
}
