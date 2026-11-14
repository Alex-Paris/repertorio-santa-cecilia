import type { CelebrationSummary, LiturgicalCelebrationContext } from "../domain/calendar";

/** Resumo de uma celebração de teste, como a busca devolve. */
export function toCelebrationSummaryForTest(context: LiturgicalCelebrationContext): CelebrationSummary {
  return {
    celebrationId: context.celebrationId,
    date: context.date,
    title: context.title,
    massVariant: context.massVariant,
    season: context.season,
    rank: context.rank,
    scope: context.scope,
    diocese: context.diocese,
    revision: context.revision,
    reviewStatus: context.review.status,
    color: context.liturgicalColor?.color ?? null,
  };
}
