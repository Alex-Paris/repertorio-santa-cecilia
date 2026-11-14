import { z } from "zod";

import { FACT_FIELDS, type FactField, type ReviewStatus } from "./calendar";
import { MAX_REVIEW_NOTE_LENGTH, type CelebrationRecord } from "./celebration-record";

export const REVIEW_ACTIONS = ["approve", "dispute", "resolve", "reopen"] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  approve: "Aprovar",
  dispute: "Registrar divergência",
  resolve: "Resolver divergência",
  reopen: "Reabrir revisão",
};

/**
 * Transições permitidas. `reviewed` só se alcança por `approve`, sempre pedido por uma pessoa
 * da administração: importação e edição nunca aprovam. Uma divergência precisa ser resolvida
 * antes de nova aprovação.
 */
export const REVIEW_TRANSITIONS: Record<ReviewStatus, Partial<Record<ReviewAction, ReviewStatus>>> = {
  pending_review: { approve: "reviewed", dispute: "disputed" },
  reviewed: { reopen: "needs_update", dispute: "disputed" },
  disputed: { resolve: "pending_review" },
  needs_update: { approve: "reviewed", dispute: "disputed" },
};

export function nextReviewStatus(status: ReviewStatus, action: ReviewAction): ReviewStatus | null {
  return REVIEW_TRANSITIONS[status][action] ?? null;
}

export function allowedReviewActions(status: ReviewStatus): ReviewAction[] {
  return Object.keys(REVIEW_TRANSITIONS[status]) as ReviewAction[];
}

/**
 * Estado depois de uma edição de conteúdo. Uma aprovação nunca sobrevive a uma mudança: a
 * celebração volta à revisão. Uma divergência continua aberta até ser resolvida.
 */
export function statusAfterEdit(status: ReviewStatus): ReviewStatus {
  return status === "disputed" ? "disputed" : "pending_review";
}

const note = z.string().trim().min(1, "Registre uma observação.").max(MAX_REVIEW_NOTE_LENGTH);

export const reviewRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("approve"),
    /** Confirma que uma pessoa conferiu o conteúdo nas fontes. Sem isso, não há aprovação. */
    humanReviewConfirmed: z.literal(true, { error: "Confirme que você conferiu a celebração nas fontes." }),
    sourceIds: z.array(z.string().min(1).max(40)).min(1, "Indique as fontes que fundamentam a aprovação."),
    note: note.optional(),
  }),
  z.strictObject({
    action: z.literal("dispute"),
    fields: z
      .array(z.enum(FACT_FIELDS))
      .min(1, "Indique o que está em divergência.")
      .refine((list) => new Set(list).size === list.length, "Há itens repetidos."),
    note,
  }),
  z.strictObject({ action: z.literal("resolve"), note }),
  z.strictObject({ action: z.literal("reopen"), note }),
]);

export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

export type ReviewCheck = { ok: true; status: ReviewStatus } | { ok: false; message: string };

/** Confere se a ação é válida para a celebração neste estado e com estas fontes. */
export function checkReviewRequest(record: Pick<CelebrationRecord, "reviewStatus" | "sources">, request: ReviewRequest): ReviewCheck {
  const status = nextReviewStatus(record.reviewStatus, request.action);
  if (!status) {
    return { ok: false, message: "Esta ação não é possível no estado atual da celebração." };
  }
  if (request.action === "approve") {
    const known = new Set(record.sources.map((source) => source.id));
    if (!request.sourceIds.every((id) => known.has(id)) || new Set(request.sourceIds).size !== request.sourceIds.length) {
      return { ok: false, message: "As fontes da aprovação precisam estar registradas na celebração." };
    }
  }
  return { ok: true, status };
}

export type { FactField };
