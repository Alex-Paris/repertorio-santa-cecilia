import { execFile } from "node:child_process";
import { promisify } from "node:util";

import mongoose from "mongoose";

import type { SongInput } from "@/features/songs/domain/song";
import { getAuth } from "@/server/auth/auth";
import { closeMongoClient } from "@/server/database/mongodb-client";
import { closeMongoose, connectToMongoose } from "@/server/database/mongoose-connection";

export const ORIGIN = "http://localhost:3000";

export const hostedSong: SongInput = {
  title: "Caminhos",
  artist: "Banda Exemplo",
  originalKey: "G",
  contentType: "original",
  chordPro: "[G]Hoje vou se[D]guir\n\n[Em]Por um novo [C]lugar",
};

export const externalSong: SongInput = {
  title: "Noite no Cais",
  artist: "Trio Demonstração",
  originalKey: "Bb",
  contentType: "external-link",
  sourceUrl: "https://example.com/cifra",
};

export async function clearDatabase(): Promise<void> {
  const { connection } = await connectToMongoose();
  await Promise.all(
    Object.values(connection.collections).map((collection) => collection.deleteMany({})),
  );
}

/** Remove somente o banco temporário desta execução e encerra as conexões. */
export async function dropTestDatabase(): Promise<void> {
  if (!process.env.MONGODB_DB_NAME?.startsWith("repertorio_test_")) {
    throw new Error("Recusado: o banco atual não é um banco de teste.");
  }
  await connectToMongoose();
  await mongoose.connection.dropDatabase();
  await closeMongoose();
  await closeMongoClient();
}

export function authRequest(path: string, body: unknown, cookie?: string): Promise<Response> {
  return getAuth().handler(
    new Request(`${ORIGIN}/api/auth/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

export function getCookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  cookie: string;
}

export async function createTestUser(name: string): Promise<TestUser> {
  const email = `${name}-${crypto.randomUUID()}@exemplo.test`;
  const password = "senha-de-teste-123";
  const response = await authRequest("sign-up/email", { name, email, password });

  if (response.status !== 200) {
    throw new Error(`Cadastro de teste falhou: ${response.status}`);
  }

  const { user } = (await response.json()) as { user: { id: string } };
  return { id: user.id, email, password, cookie: getCookieHeader(response) };
}

const runFile = promisify(execFile);

/** Executa um script de manutenção contra o banco temporário desta suíte, como a documentação manda. */
export async function runScript(script: string, ...args: string[]): Promise<string> {
  const { stdout } = await runFile(process.execPath, [`scripts/${script}`, ...args], { env: process.env });
  return stdout;
}

/** Importação explícita da base editorial de celebrações (sempre em revisão). */
export function importEditorialCelebrations(): Promise<string> {
  return runScript("import-liturgical-celebrations.mjs");
}

