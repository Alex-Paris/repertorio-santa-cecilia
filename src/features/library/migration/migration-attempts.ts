import { z } from "zod";

import type { LibraryRecord } from "../domain/library";
import { LibraryError } from "../domain/library-errors";

const ATTEMPT_KEY_PREFIX = "repertorio.migration.v1.";

const attemptSchema = z.object({
  userId: z.string().min(1),
  importId: z.uuid(),
  /** Identifica o conteúdo enviado sem guardar uma segunda cópia da biblioteca. */
  fingerprint: z.string().min(1),
  status: z.enum(["pending", "completed"]),
  startedAt: z.iso.datetime(),
});

export type MigrationAttempt = z.infer<typeof attemptSchema>;

export interface MigrationAttemptStore {
  load(): MigrationAttempt | null;
  /** Lança `LibraryError` se a gravação falhar: sem registro, a importação não pode começar. */
  save(attempt: MigrationAttempt): void;
  clear(): void;
}

/** A tentativa pertence a um usuário: contas diferentes nunca veem a mesma chave. */
export function createMigrationAttemptStore(
  userId: string,
  getStorage: () => Pick<Storage, "getItem" | "setItem" | "removeItem">,
): MigrationAttemptStore {
  const key = `${ATTEMPT_KEY_PREFIX}${userId}`;

  return {
    load() {
      try {
        const raw = getStorage().getItem(key);
        const result = attemptSchema.safeParse(raw === null ? null : JSON.parse(raw));
        return result.success && result.data.userId === userId ? result.data : null;
      } catch {
        return null;
      }
    },

    save(attempt) {
      try {
        getStorage().setItem(key, JSON.stringify(attempt));
      } catch (error) {
        throw new LibraryError(
          error instanceof DOMException && error.name === "QuotaExceededError"
            ? "quota-exceeded"
            : "storage-unavailable",
        );
      }
    },

    clear() {
      try {
        getStorage().removeItem(key);
      } catch {
        // Sem armazenamento não há registro a remover.
      }
    },
  };
}

/** Identificador local e não criptográfico, usado só para detectar mudanças no conteúdo. */
export function fingerprintLibrary(library: LibraryRecord): string {
  const text = JSON.stringify(library);
  let first = 0xdeadbeef;
  let second = 0x41c6ce57;

  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 2654435761);
    second = Math.imul(second ^ code, 1597334677);
  }

  first = Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909);
  second = Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(first ^ (first >>> 13), 3266489909);

  return `${text.length}-${(second >>> 0).toString(16)}${(first >>> 0).toString(16)}`;
}
