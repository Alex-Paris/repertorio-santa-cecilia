import "server-only";

import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";

import { connectMongoClient, getMongoClient } from "@/server/database/mongodb-client";
import { getServerEnv } from "@/server/env";

import { isSignUpEnabled } from "./sign-up-policy";

function createAuth() {
  const env = getServerEnv();
  const client = getMongoClient();

  return betterAuth({
    appName: "Repertório",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // Informar o `client` ativa transações, que exigem um replica set.
    database: mongodbAdapter(client.db(env.MONGODB_DB_NAME), { client }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !isSignUpEnabled(process.env.NODE_ENV, env.AUTH_ALLOW_DEV_SIGNUP),
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    telemetry: { enabled: false },
    // Sem isto, a biblioteca desliga a checagem de origem ao detectar ambiente de teste.
    advanced: { disableOriginCheck: false },
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as typeof globalThis & { __repertorioAuth?: Auth };

/** Criada na primeira requisição: o build não depende de banco nem de variáveis de ambiente. */
export function getAuth(): Auth {
  globalForAuth.__repertorioAuth ??= createAuth();
  return globalForAuth.__repertorioAuth;
}

/** Para uso em requisições: garante a conexão com o banco antes de autenticar. */
export async function getConnectedAuth(): Promise<Auth> {
  await connectMongoClient();
  return getAuth();
}

export function resetAuthForTests(): void {
  globalForAuth.__repertorioAuth = undefined;
}
