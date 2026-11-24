import "server-only";

import type { TransactionOptions } from "mongodb";
import mongoose, { type ClientSession } from "mongoose";

import { LibraryError } from "@/features/library/domain/library-errors";
import { entityIdSchema, revisionSchema } from "@/features/songs/domain/song-schema";
import { connectToMongoose } from "@/server/database/mongoose-connection";
import { ServerConfigurationError } from "@/server/env";

/** Operação sempre restrita a um usuário, definido pelo servidor a partir da sessão. */
export interface OwnerContext {
  ownerId: string;
}

const DUPLICATE_KEY_CODE = 11000;
const TRANSACTIONS_UNSUPPORTED_CODE = 20;

function getErrorCode(error: unknown): unknown {
  return typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
}

function translatePersistenceError(error: unknown): LibraryError {
  if (error instanceof LibraryError) {
    return error;
  }

  const code = getErrorCode(error);
  if (code === DUPLICATE_KEY_CODE) {
    return new LibraryError("conflict");
  }
  if (error instanceof ServerConfigurationError) {
    console.error("[persistência] Falha: ServerConfigurationError.", JSON.stringify({
      invalidVariables: error.variableNames,
    }));
  } else if (code === TRANSACTIONS_UNSUPPORTED_CODE) {
    console.error("[persistência] O MongoDB precisa ser um replica set para usar transações.");
  } else {
    // Só o tipo do erro: a mensagem do driver pode citar dados ou a URI de conexão.
    console.error(`[persistência] Falha: ${error instanceof Error ? error.name : "desconhecida"}.`);
  }
  return new LibraryError("persistence-failed");
}

/** Conecta, executa e converte qualquer falha em um erro de domínio. */
export async function runPersistence<T>(operation: () => Promise<T>): Promise<T> {
  try {
    await connectToMongoose();
    return await operation();
  } catch (error) {
    throw translatePersistenceError(error);
  }
}

/** Transação com novas tentativas automáticas em conflitos de escrita. */
export function runTransaction<T>(
  operation: (session: ClientSession) => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  return runPersistence(() => mongoose.connection.transaction(operation, options));
}

/**
 * Filtro da revisão esperada, para entrar na própria operação de escrita. Documentos
 * anteriores ao controle de versão não têm o campo e valem como revisão 1.
 */
export function revisionFilter(expected: number): Record<string, unknown> {
  return expected === 1
    ? { $or: [{ revision: 1 }, { revision: { $exists: false } }] }
    : { revision: expected };
}

/** A revisão esperada é obrigatória em toda alteração. */
export function assertRevision(expected: unknown): asserts expected is number {
  if (!revisionSchema.safeParse(expected).success) {
    throw new LibraryError("revision-required");
  }
}

/** Um ID com formato impossível não pode existir; também impede objetos como filtro de consulta. */
export function isValidEntityId(id: unknown): id is string {
  return entityIdSchema.safeParse(id).success;
}
