import { EDITORIAL_CELEBRATIONS } from "@/features/liturgy/data/editorial-celebrations";
import type { LiturgicalCelebrationContext } from "@/features/liturgy/domain/calendar";
import { toPublicCelebration, type CelebrationRecord } from "@/features/liturgy/domain/celebration-record";

/** Registro como sai da importação: sempre em revisão, nunca aprovado. */
export function editorialRecord(date: string, overrides: Partial<CelebrationRecord> = {}): CelebrationRecord {
  const entry = EDITORIAL_CELEBRATIONS.find((celebration) => celebration.input.date === date);
  if (!entry) {
    throw new Error(`Sem celebração editorial em ${date}`);
  }
  return {
    ...structuredClone(entry.input),
    id: entry.id,
    reviewStatus: "pending_review",
    approval: null,
    dispute: null,
    revision: 1,
    createdAt: "2026-11-14T00:00:00.000Z",
    updatedAt: "2026-11-14T00:00:00.000Z",
    ...overrides,
  };
}

/** Contexto público de uma celebração da base editorial, no estado pedido. */
export function editorialContext(date: string, overrides: Partial<CelebrationRecord> = {}): LiturgicalCelebrationContext {
  return toPublicCelebration(editorialRecord(date, overrides));
}

/** A mesma celebração, aprovada por uma pessoa da administração. */
export function reviewedContext(date: string): LiturgicalCelebrationContext {
  return editorialContext(date, {
    reviewStatus: "reviewed",
    revision: 2,
    approval: { by: "admin-teste", at: "2026-11-14T12:00:00.000Z", revision: 1, sourceIds: ["fonte-1"] },
  });
}
