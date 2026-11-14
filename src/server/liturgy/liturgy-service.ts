import "server-only";

import {
  isValidIsoDate,
  type CelebrationPage,
  type CelebrationQuery,
  type LiturgicalCalendarProvider,
  type LiturgicalCelebrationContext,
} from "@/features/liturgy/domain/calendar";
import {
  DEFAULT_SUGGESTIONS_PER_MOMENT,
  MAX_SUGGESTIONS_PER_MOMENT,
  diagnoseCelebration,
  recommendForCelebration,
  type CelebrationRecommendation,
  type MomentDiagnosis,
} from "@/features/liturgy/domain/recommendation";
import { LITURGICAL_MOMENT_IDS, type LiturgicalMomentId } from "@/features/liturgy/domain/vocabulary";
import {
  getCatalogCoverageStats,
  listClassifiedForMoments,
  listSuggestionCandidates,
} from "@/server/catalog/catalog-service";

import { mongoCalendarProvider } from "./celebration-store";

/** Único ponto que escolhe a fonte do calendário. Trocar de provedor não muda quem consome. */
const provider: LiturgicalCalendarProvider = mongoCalendarProvider;

/** Celebrações da data. Lista vazia para datas inválidas ou fora da cobertura: nada é estimado. */
export async function getCelebrationsByDate(date: string): Promise<LiturgicalCelebrationContext[]> {
  return isValidIsoDate(date) ? provider.getByDate(date) : [];
}

export function getCelebrationById(celebrationId: string): Promise<LiturgicalCelebrationContext | null> {
  return provider.getById(celebrationId);
}

export function searchCelebrations(query: CelebrationQuery): Promise<CelebrationPage> {
  return provider.search(query);
}

/**
 * A celebração escolhida na data. Com várias (formulários, particularidades), vale a pedida
 * por ID; sem pedido, a primeira na ordem estável. Nunca troca de data por conta própria:
 * sábado à noite não vira domingo automaticamente.
 */
export function pickCelebration(
  celebrations: readonly LiturgicalCelebrationContext[],
  celebrationId?: string | null,
): LiturgicalCelebrationContext | null {
  return celebrations.find((entry) => entry.celebrationId === celebrationId) ?? celebrations[0] ?? null;
}

/**
 * Sugestões para a celebração. Lê do catálogo só músicas publicadas e classificadas; as
 * restrições, a ordem e o efeito do estado editorial ficam no domínio, sem depender do banco.
 */
export async function getCelebrationSuggestions(
  context: LiturgicalCelebrationContext,
  moment?: LiturgicalMomentId,
): Promise<CelebrationRecommendation> {
  const moments = moment ? [moment] : LITURGICAL_MOMENT_IDS;
  // O banco já descarta o que é de outro tempo ou celebração; as demais regras ficam no domínio.
  const candidates = await listSuggestionCandidates({ moments, season: context.season, celebrations: context.celebrations });
  const stats = await getCatalogCoverageStats();
  const recommendation = recommendForCelebration(context, candidates, {
    moments,
    limitPerMoment: moment ? MAX_SUGGESTIONS_PER_MOMENT : DEFAULT_SUGGESTIONS_PER_MOMENT,
  });
  return {
    ...recommendation,
    catalog: { published: stats.published, classified: stats.classified, classifiedForMass: stats.classifiedForMass },
    moments: recommendation.moments.map((entry) => ({ ...entry, classifiedForMoment: stats.byMoment[entry.moment] ?? 0 })),
  };
}

/** Diagnóstico para a administração: todas as classificadas, inclusive as descartadas, e por quê. */
export async function diagnoseCelebrationSuggestions(
  context: LiturgicalCelebrationContext,
): Promise<{ moments: MomentDiagnosis[]; truncated: boolean }> {
  const { candidates, truncated } = await listClassifiedForMoments(LITURGICAL_MOMENT_IDS);
  return { moments: diagnoseCelebration(context, candidates), truncated };
}
