import "server-only";

import type { ClientSession } from "mongoose";

import { LibraryStateModel } from "@/server/database/models/library-state-model";

import { runPersistence, runTransaction } from "./persistence";

const DUPLICATE_KEY_CODE = 11000;

/**
 * Cria o documento de estado fora da transação. Assim, duas transações disputam um
 * documento existente e o MongoDB responde com conflito de escrita, que tem nova
 * tentativa automática. Inserções concorrentes do mesmo documento não teriam.
 */
export async function ensureLibraryState(ownerId: string): Promise<void> {
  await runPersistence(async () => {
    try {
      await LibraryStateModel.updateOne(
        { ownerId },
        { $setOnInsert: { revision: 0 } },
        { upsert: true },
      );
    } catch (error) {
      // Outra requisição criou o documento primeiro: o resultado é o mesmo.
      if ((error as { code?: unknown }).code !== DUPLICATE_KEY_CODE) {
        throw error;
      }
    }
  });
}

/** Escrita que disputa o estado do usuário: conflita com qualquer outra do mesmo proprietário. */
export async function reserveLibraryState(ownerId: string, session: ClientSession): Promise<void> {
  await LibraryStateModel.updateOne({ ownerId }, { $inc: { revision: 1 } }, { session });
}

/** Transação para operações que adicionam documentos à biblioteca de um usuário. */
export async function runLibraryWrite<T>(
  ownerId: string,
  operation: (session: ClientSession) => Promise<T>,
): Promise<T> {
  await ensureLibraryState(ownerId);

  return runTransaction(async (session) => {
    await reserveLibraryState(ownerId, session);
    return operation(session);
  });
}
