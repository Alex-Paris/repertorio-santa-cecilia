import "server-only";

import { MongoClient } from "mongodb";

import { getServerEnv } from "@/server/env";

// Fica em `globalThis` para sobreviver ao hot reload e não abrir um cliente por requisição.
const globalForMongoClient = globalThis as typeof globalThis & {
  __repertorioMongoClient?: MongoClient;
};

/** Cliente do driver oficial, usado pelo Better Auth. Não abre conexão ao ser criado. */
export function getMongoClient(): MongoClient {
  globalForMongoClient.__repertorioMongoClient ??= new MongoClient(getServerEnv().MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  return globalForMongoClient.__repertorioMongoClient;
}

/**
 * Conecta de forma explícita. Após uma primeira conexão falha, a conexão automática do
 * driver fica encerrada para sempre; `connect()` é o que permite recuperar o serviço.
 */
export async function connectMongoClient(): Promise<void> {
  await getMongoClient().connect();
}

export async function closeMongoClient(): Promise<void> {
  const client = globalForMongoClient.__repertorioMongoClient;
  globalForMongoClient.__repertorioMongoClient = undefined;
  await client?.close();
}
