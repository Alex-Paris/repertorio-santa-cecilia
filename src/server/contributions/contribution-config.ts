import "server-only";

import { z } from "zod";

export interface ContributionLimits {
  /** Propostas em análise ou aguardando correção, por conta. */
  maxPending: number;
  /** Propostas novas nas últimas 24 horas, por conta. */
  maxPerDay: number;
  /** Tamanho máximo da cifra enviada, em caracteres. */
  maxChordProLength: number;
}

export const DEFAULT_CONTRIBUTION_LIMITS: ContributionLimits = {
  maxPending: 5,
  maxPerDay: 10,
  maxChordProLength: 50_000,
};

/** O Docker Compose entrega variáveis não definidas como texto vazio. */
function blankToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

function limit(fallback: number, maximum: number) {
  return z.preprocess(blankToUndefined, z.coerce.number().int().positive().max(maximum).default(fallback));
}

const contributionEnvSchema = z.object({
  CONTRIBUTION_MAX_PENDING: limit(DEFAULT_CONTRIBUTION_LIMITS.maxPending, 1000),
  CONTRIBUTION_MAX_PER_DAY: limit(DEFAULT_CONTRIBUTION_LIMITS.maxPerDay, 1000),
  // A cifra de uma música particular já é limitada a 100 mil caracteres.
  CONTRIBUTION_MAX_CHORDPRO_LENGTH: limit(DEFAULT_CONTRIBUTION_LIMITS.maxChordProLength, 100_000),
});

/** Configuração inválida volta aos valores padrão, sem derrubar a aplicação. */
export function parseContributionLimits(source: Record<string, string | undefined>): ContributionLimits {
  const result = contributionEnvSchema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    console.error(`[contribuições] Configuração inválida: ${names.join(", ")}. Valores padrão em uso.`);
    return DEFAULT_CONTRIBUTION_LIMITS;
  }
  return {
    maxPending: result.data.CONTRIBUTION_MAX_PENDING,
    maxPerDay: result.data.CONTRIBUTION_MAX_PER_DAY,
    maxChordProLength: result.data.CONTRIBUTION_MAX_CHORDPRO_LENGTH,
  };
}

export function getContributionLimits(): ContributionLimits {
  return parseContributionLimits(process.env);
}
