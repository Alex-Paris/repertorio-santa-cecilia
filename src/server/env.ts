import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\/.+/),
  MONGODB_DB_NAME: z.string().regex(/^[\w-]{1,63}$/),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
  AUTH_ALLOW_DEV_SIGNUP: z.enum(["true", "false"]).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class ServerConfigurationError extends Error {
  constructor(variableNames: string[]) {
    // Somente os nomes: o valor de uma variável inválida nunca entra na mensagem.
    super(`Variáveis de ambiente ausentes ou inválidas: ${variableNames.join(", ")}.`);
    this.name = "ServerConfigurationError";
  }
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);

  if (!result.success) {
    throw new ServerConfigurationError([
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ]);
  }

  return result.data;
}

/** Lida somente em tempo de requisição, para o build não depender de configuração. */
export function getServerEnv(): ServerEnv {
  return parseServerEnv(process.env);
}
