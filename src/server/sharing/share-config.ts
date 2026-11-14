import "server-only";

import { z } from "zod";

export interface SharingLimits {
  linksPerRepertoire: number;
  linksPerUser: number;
  itemsPerShare: number;
  snapshotBytes: number;
  writesPerHour: number;
}

export interface SharingConfig {
  enabled: boolean;
  /** `null` sem chave válida: links não podem ser gerados nem conferidos. */
  secret: string | null;
  limits: SharingLimits;
}

const DEFAULT_LIMITS: SharingLimits = {
  linksPerRepertoire: 10,
  linksPerUser: 50,
  itemsPerShare: 200,
  snapshotBytes: 4 * 1024 * 1024,
  writesPerHour: 60,
};

/** O Docker Compose entrega variáveis não definidas como texto vazio. */
function blankToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

function limit(fallback: number, maximum: number) {
  return z.preprocess(blankToUndefined, z.coerce.number().int().positive().max(maximum).default(fallback));
}

const sharingEnvSchema = z.object({
  PUBLIC_SHARING_ENABLED: z.preprocess(blankToUndefined, z.enum(["true", "false"]).optional()),
  SHARE_LINK_SECRET: z.preprocess(blankToUndefined, z.string().min(32).optional()),
  SHARE_MAX_LINKS_PER_REPERTOIRE: limit(DEFAULT_LIMITS.linksPerRepertoire, 1000),
  SHARE_MAX_LINKS_PER_USER: limit(DEFAULT_LIMITS.linksPerUser, 100_000),
  SHARE_MAX_ITEMS: limit(DEFAULT_LIMITS.itemsPerShare, 2000),
  // Abaixo do limite de 16 MB de um documento do MongoDB.
  SHARE_MAX_SNAPSHOT_BYTES: limit(DEFAULT_LIMITS.snapshotBytes, 12 * 1024 * 1024),
  SHARE_MAX_WRITES_PER_HOUR: limit(DEFAULT_LIMITS.writesPerHour, 100_000),
});

/**
 * Validada à parte das variáveis obrigatórias: uma configuração errada aqui desliga o
 * compartilhamento, sem derrubar o restante da aplicação.
 */
export function parseSharingConfig(source: Record<string, string | undefined>): SharingConfig {
  const result = sharingEnvSchema.safeParse(source);

  if (!result.success) {
    // Somente os nomes: o valor pode ser a própria chave.
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    console.error(`[compartilhamento] Configuração inválida: ${names.join(", ")}.`);
    return { enabled: false, secret: null, limits: DEFAULT_LIMITS };
  }

  const env = result.data;
  const secret = env.SHARE_LINK_SECRET ?? null;

  if (env.PUBLIC_SHARING_ENABLED === "true" && !secret) {
    console.error("[compartilhamento] PUBLIC_SHARING_ENABLED exige SHARE_LINK_SECRET.");
  }

  return {
    enabled: env.PUBLIC_SHARING_ENABLED === "true" && secret !== null,
    secret,
    limits: {
      linksPerRepertoire: env.SHARE_MAX_LINKS_PER_REPERTOIRE,
      linksPerUser: env.SHARE_MAX_LINKS_PER_USER,
      itemsPerShare: env.SHARE_MAX_ITEMS,
      snapshotBytes: env.SHARE_MAX_SNAPSHOT_BYTES,
      writesPerHour: env.SHARE_MAX_WRITES_PER_HOUR,
    },
  };
}

/** Lida a cada requisição: desligar a variável vale sem depender de cache. */
export function getSharingConfig(): SharingConfig {
  return parseSharingConfig(process.env);
}
