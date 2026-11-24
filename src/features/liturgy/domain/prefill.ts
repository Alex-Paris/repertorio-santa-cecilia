import { z } from "zod";

import type { CelebrationRank } from "./calendar";
import { celebrationInputSchema, type CelebrationInput } from "./celebration-record";

export interface LiturgyPrefill {
  draft: Omit<CelebrationInput, "rank"> & { rank: CelebrationRank | null };
  warnings: string[];
}

const draftSchema = z.unknown().transform((input, context): LiturgyPrefill["draft"] => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    context.addIssue({ code: "custom", message: "Prévia inválida." });
    return z.NEVER;
  }
  const rank = (input as { rank?: unknown }).rank;
  const parsed = celebrationInputSchema.safeParse({ ...input, rank: rank === null ? "feria" : rank });
  if (!parsed.success) {
    context.addIssue({ code: "custom", message: "Dados consultados fora do formato esperado." });
    return z.NEVER;
  }
  return { ...parsed.data, rank: rank === null ? null : parsed.data.rank };
});

/** Grau desconhecido exige escolha antes de o conteúdo poder virar uma celebração. */
export const liturgyPrefillSchema: z.ZodType<LiturgyPrefill> = z.object({
  draft: draftSchema,
  warnings: z.array(z.string().max(1000)).max(20),
});

