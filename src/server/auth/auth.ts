import "server-only";

import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";

import { connectMongoClient, getMongoClient } from "@/server/database/mongodb-client";
import { SITE_NAME } from "@/lib/site";
import { getServerEnv } from "@/server/env";

import { isSignUpEnabled, requiresEmailVerification } from "./sign-up-policy";
import { sendVerificationEmail } from "./verification-email";

function createAuth() {
  const env = getServerEnv();
  const client = getMongoClient();

  return betterAuth({
    appName: SITE_NAME,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // Informar o `client` ativa transações, que exigem um replica set.
    database: mongodbAdapter(client.db(env.MONGODB_DB_NAME), { client }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !isSignUpEnabled(process.env),
      requireEmailVerification: requiresEmailVerification(process.env),
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    emailVerification: requiresEmailVerification(process.env) ? {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 3600,
      sendVerificationEmail: ({ user, url }) => sendVerificationEmail({ to: user.email, url }),
    } : undefined,
    rateLimit: {
      enabled: process.env.NODE_ENV === "production",
      storage: "database",
      customRules: {
        "/sign-up/email": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 3 },
      },
    },
    telemetry: { enabled: false },
    // Sem isto, a biblioteca desliga a checagem de origem ao detectar ambiente de teste.
    advanced: {
      disableOriginCheck: false,
      // A Vercel sobrescreve este cabeçalho; fora dela, não confiar em IP enviado pelo cliente.
      ipAddress: { ipAddressHeaders: process.env.VERCEL === "1" ? ["x-forwarded-for"] : [] },
    },
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
