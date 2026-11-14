import type { MusicalKey } from "@/features/songs/domain/musical-key";
import type { CatalogContentType } from "@/features/songs/domain/song";

import {
  FACT_FIELD_LABELS,
  REVIEW_STATUS_LABELS,
  type LiturgicalCelebrationContext,
  type LiturgicalReading,
  type ReadingRole,
} from "./calendar";
import type { PublicSongClassification } from "./classification";
import { findPsalm, getMomentGuidance, type MomentGuidance } from "./rubrics";
import { scriptureOverlaps } from "./scripture";
import {
  LITURGICAL_MOMENTS,
  LITURGICAL_SEASONS,
  celebrationLabel,
  isMassCategory,
  themeLabel,
  type BiblicalThemeId,
  type LiturgicalCelebrationId,
  type LiturgicalMomentId,
} from "./vocabulary";

/** Música publicada do catálogo, com a classificação cadastrada pela administração. */
export interface SuggestionCandidate {
  id: string;
  title: string;
  artist: string;
  /** Desconhecido em músicas cadastradas só com metadados. */
  originalKey?: MusicalKey;
  contentType: CatalogContentType;
  hasChordPro: boolean;
  liturgy: PublicSongClassification;
}

export type SuggestionCriterion = "moment" | "celebration" | "reading" | "season" | "theme";

export interface SuggestionReason {
  criterion: SuggestionCriterion;
  text: string;
}

/** O que a música tem em comum com a celebração, separado por critério. */
export interface SuggestionMatches {
  celebrations: LiturgicalCelebrationId[];
  readings: ReadingRole[];
  season: boolean;
  themes: BiblicalThemeId[];
}

export interface SongSuggestion {
  song: Omit<SuggestionCandidate, "liturgy">;
  /** Por que a música apareceu, sempre a partir da classificação cadastrada. */
  reasons: SuggestionReason[];
  /** Correspondências por critério: celebração, leituras, tempo e temas. */
  matches: SuggestionMatches;
  /** Prioridade editorial: celebração, leituras, tempo, quantidade de temas. */
  priority: [number, number, number, number];
  /** `official` só quando a classificação cita um documento oficial específico. */
  basis: "editorial" | "official";
  officialReference: string | null;
  /** Orientação de uso registrada na classificação. */
  suitabilityNotes: string | null;
  /** Se uma pessoa da equipe conferiu a classificação desta música. */
  classification: "reviewed" | "pending_review";
}

export interface MomentSuggestions {
  moment: LiturgicalMomentId;
  guidance: MomentGuidance;
  suggestions: SongSuggestion[];
  /** Quantas músicas são elegíveis, mesmo que nem todas apareçam. */
  total: number;
  /** Quantas músicas publicadas estão classificadas para o momento, elegíveis ou não. */
  classifiedForMoment?: number;
}

export type RecommendationContext = Pick<
  LiturgicalCelebrationContext,
  "season" | "rank" | "readings" | "celebrations" | "biblicalThemes"
>;

export type Eligibility =
  | { eligible: true }
  | {
      eligible: false;
      rule:
        | "classification-disputed"
        | "not-for-mass"
        | "other-moment"
        | "moment-omitted"
        | "season-restricted"
        | "other-season-or-celebration"
        | "proper-text-elsewhere"
        | "psalm-not-of-the-day";
    };

const READING_TARGETS: Record<ReadingRole, string> = {
  first: "à 1ª leitura",
  psalm: "ao salmo responsorial",
  second: "à 2ª leitura",
  gospel: "ao Evangelho",
};

function matchedReadings(classification: PublicSongClassification, readings: readonly LiturgicalReading[]): LiturgicalReading[] {
  return readings.filter((reading) =>
    reading.ranges.some((range) => classification.scripture.some((reference) => scriptureOverlaps(reference, range))),
  );
}

function matchedCelebrations(classification: PublicSongClassification, context: RecommendationContext): string[] {
  return classification.celebrations.filter((celebration) => context.celebrations.includes(celebration));
}

/**
 * Restrições, aplicadas antes de qualquer ordenação. Uma música barrada aqui nunca é
 * sugerida, por mais temas que tenha em comum com a celebração.
 */
export function checkEligibility(
  context: RecommendationContext,
  moment: LiturgicalMomentId,
  classification: PublicSongClassification,
): Eligibility {
  if (classification.reviewStatus === "disputed") {
    return { eligible: false, rule: "classification-disputed" };
  }
  if (!isMassCategory(classification.category)) {
    return { eligible: false, rule: "not-for-mass" };
  }
  if (!classification.moments.includes(moment)) {
    return { eligible: false, rule: "other-moment" };
  }
  if (getMomentGuidance(context, moment).status === "omitted") {
    return { eligible: false, rule: "moment-omitted" };
  }
  if (classification.avoidSeasons.includes(context.season)) {
    return { eligible: false, rule: "season-restricted" };
  }

  const celebrationMatch = matchedCelebrations(classification, context).length > 0;
  const seasonMatch = classification.seasons.includes(context.season);
  const scoped = classification.seasons.length > 0 || classification.celebrations.length > 0;
  // Música própria de um tempo ou de uma celebração só aparece neles.
  if (scoped && !seasonMatch && !celebrationMatch) {
    return { eligible: false, rule: "other-season-or-celebration" };
  }

  const readingMatch = matchedReadings(classification, context.readings).length > 0;
  if (classification.category === "proper-text" && !celebrationMatch && !readingMatch) {
    return { eligible: false, rule: "proper-text-elsewhere" };
  }

  if (moment === "salmo-responsorial") {
    // O salmo responsorial é o do Lecionário: só serve a música ligada a esse texto.
    const psalm = findPsalm(context);
    const matchesPsalm =
      psalm !== null &&
      psalm.ranges.some((range) => classification.scripture.some((reference) => scriptureOverlaps(reference, range)));
    if (!matchesPsalm) {
      return { eligible: false, rule: "psalm-not-of-the-day" };
    }
  }

  return { eligible: true };
}

interface Ranked {
  suggestion: SongSuggestion;
  /** Ordem de prioridade: celebração, leituras, tempo e temas. O momento já é condição. */
  rank: [number, number, number, number];
}

function rankCandidate(
  context: RecommendationContext,
  moment: LiturgicalMomentId,
  candidate: SuggestionCandidate,
): Ranked {
  const { liturgy, ...song } = candidate;
  const momentEntry = LITURGICAL_MOMENTS.find((entry) => entry.id === moment);
  const reasons: SuggestionReason[] = [{ criterion: "moment", text: `Adequada ${momentEntry?.to ?? moment}` }];

  const celebrations = matchedCelebrations(liturgy, context);
  for (const celebration of celebrations) {
    reasons.push({ criterion: "celebration", text: `Associada à celebração: ${celebrationLabel(celebration)}` });
  }

  const readings = matchedReadings(liturgy, context.readings);
  for (const reading of readings) {
    reasons.push({ criterion: "reading", text: `Relacionada ${READING_TARGETS[reading.role]} (${reading.citation})` });
  }

  const seasonMatch = liturgy.seasons.includes(context.season);
  if (seasonMatch) {
    const season = LITURGICAL_SEASONS.find((entry) => entry.id === context.season);
    reasons.push({ criterion: "season", text: `Indicada para ${season?.withArticle ?? context.season}` });
  }

  const themes = liturgy.themes.filter((theme) => context.biblicalThemes.includes(theme));
  for (const theme of themes) {
    reasons.push({ criterion: "theme", text: `Relacionada ao tema: ${themeLabel(theme).toLowerCase()}` });
  }

  const officialReference = liturgy.officialReference.trim();
  const priority: Ranked["rank"] = [celebrations.length > 0 ? 1 : 0, readings.length > 0 ? 1 : 0, seasonMatch ? 1 : 0, themes.length];
  return {
    suggestion: {
      song,
      reasons,
      matches: {
        celebrations: celebrations as LiturgicalCelebrationId[],
        readings: readings.map((reading) => reading.role),
        season: seasonMatch,
        themes,
      },
      priority,
      basis: officialReference ? "official" : "editorial",
      officialReference: officialReference || null,
      suitabilityNotes: liturgy.suitabilityNotes.trim() || null,
      classification: liturgy.reviewStatus === "reviewed" ? "reviewed" : "pending_review",
    },
    rank: priority,
  };
}

function compareRanked(a: Ranked, b: Ranked): number {
  for (let index = 0; index < a.rank.length; index++) {
    if (a.rank[index] !== b.rank[index]) {
      return b.rank[index] - a.rank[index];
    }
  }
  // Desempate estável: o resultado não depende da ordem de chegada dos candidatos.
  return (
    a.suggestion.song.title.localeCompare(b.suggestion.song.title, "pt-BR") ||
    a.suggestion.song.id.localeCompare(b.suggestion.song.id)
  );
}

export const DEFAULT_SUGGESTIONS_PER_MOMENT = 4;
export const MAX_SUGGESTIONS_PER_MOMENT = 24;

/** Sugestões de um momento: primeiro as restrições, depois a ordem. Determinístico. */
export function suggestForMoment(
  context: RecommendationContext,
  moment: LiturgicalMomentId,
  candidates: readonly SuggestionCandidate[],
  limit = DEFAULT_SUGGESTIONS_PER_MOMENT,
): MomentSuggestions {
  const eligible = candidates
    .filter((candidate) => checkEligibility(context, moment, candidate.liturgy).eligible)
    .map((candidate) => rankCandidate(context, moment, candidate))
    .sort(compareRanked);

  return {
    moment,
    guidance: getMomentGuidance(context, moment),
    suggestions: eligible.slice(0, Math.max(0, Math.min(limit, MAX_SUGGESTIONS_PER_MOMENT))).map((entry) => entry.suggestion),
    total: eligible.length,
  };
}

/** Todos os momentos da missa, na ordem da celebração. */
export function suggestForCelebration(
  context: RecommendationContext,
  candidates: readonly SuggestionCandidate[],
  options: { moments?: readonly LiturgicalMomentId[]; limitPerMoment?: number } = {},
): MomentSuggestions[] {
  const moments = options.moments ?? LITURGICAL_MOMENTS.map((moment) => moment.id);
  return LITURGICAL_MOMENTS.filter((moment) => moments.includes(moment.id)).map((moment) =>
    suggestForMoment(context, moment.id, candidates, options.limitPerMoment),
  );
}

/** Situação do catálogo publicado, para explicar a ausência de sugestões. */
export interface CatalogCoverage {
  published: number;
  classified: number;
  classifiedForMass: number;
}

export interface CelebrationRecommendation {
  /** `definitive` só com celebração revisada, sem divergência e com todas as leituras conferidas. */
  assurance: "definitive" | "provisional";
  /** Por que as sugestões são provisórias, em linguagem para quem prepara a missa. */
  cautions: string[];
  moments: MomentSuggestions[];
  catalog?: CatalogCoverage;
}

/**
 * Leituras que podem embasar sugestões. Uma leitura em divergência fica de fora: nem a
 * correspondência bíblica nem o salmo usam um dado contestado.
 */
export function usableReadings(context: Pick<LiturgicalCelebrationContext, "readings" | "review">): LiturgicalReading[] {
  return context.readings.filter((reading) => !context.review.disputedFields.includes(reading.role));
}

/**
 * Sugestões para uma celebração, condicionadas ao estado editorial. As regras da Etapa 2E.2
 * não mudam: o que muda é que dados não revisados, em divergência ou incompletos tornam o
 * resultado provisório, e leituras em divergência deixam de ser usadas.
 */
export function recommendForCelebration(
  context: LiturgicalCelebrationContext,
  candidates: readonly SuggestionCandidate[],
  options: { moments?: readonly LiturgicalMomentId[]; limitPerMoment?: number } = {},
): CelebrationRecommendation {
  const cautions: string[] = [];
  if (context.review.status !== "reviewed") {
    cautions.push(`A celebração está “${REVIEW_STATUS_LABELS[context.review.status].toLowerCase()}”: os dados ainda não foram aprovados por uma revisão humana.`);
  }
  if (context.review.disputedFields.length > 0) {
    cautions.push(
      `Há divergência em: ${context.review.disputedFields.map((field) => FACT_FIELD_LABELS[field].toLowerCase()).join(", ")}. Esses dados não são usados nas sugestões.`,
    );
  }
  if (context.unverifiedReadings.length > 0) {
    cautions.push(
      `Ainda não conferido: ${context.unverifiedReadings.map((role) => FACT_FIELD_LABELS[role].toLowerCase()).join(", ")}. Nada é sugerido no lugar.`,
    );
  }

  const recommendationContext: RecommendationContext = { ...context, readings: usableReadings(context) };
  const moments = suggestForCelebration(recommendationContext, candidates, options);
  if (moments.some((entry) => entry.suggestions.some((suggestion) => suggestion.classification !== "reviewed"))) {
    cautions.push("Há músicas sugeridas com classificação ainda não conferida por uma pessoa da equipe.");
  }
  return {
    assurance: cautions.length === 0 ? "definitive" : "provisional",
    cautions,
    moments,
  };
}

export type DiscardRule = Extract<Eligibility, { eligible: false }>["rule"];

export const DISCARD_RULE_LABELS: Record<DiscardRule, string> = {
  "classification-disputed": "Classificação com divergência",
  "not-for-mass": "Não é canto para a missa",
  "other-moment": "Indicada para outro momento",
  "moment-omitted": "Momento sem canto nesta celebração",
  "season-restricted": "Restrita neste tempo",
  "other-season-or-celebration": "Própria de outro tempo ou celebração",
  "proper-text-elsewhere": "Texto próprio de outra celebração",
  "psalm-not-of-the-day": "Não é o salmo do dia",
};

export interface MomentDiagnosis {
  moment: LiturgicalMomentId;
  /** Músicas publicadas classificadas para o momento. */
  classified: number;
  eligible: number;
  /** Elegíveis com classificação conferida por uma pessoa. */
  reviewed: number;
  /** Elegíveis com cifra que pode ser exibida. */
  withChordPro: number;
  discarded: Partial<Record<DiscardRule, number>>;
}

/**
 * Por que cada momento tem (ou não) sugestões: quantas músicas classificadas existem, quantas
 * passam pelas regras e por qual motivo as demais ficam de fora. Mesmas regras das sugestões.
 */
export function diagnoseCelebration(
  context: LiturgicalCelebrationContext,
  candidates: readonly SuggestionCandidate[],
): MomentDiagnosis[] {
  const recommendationContext: RecommendationContext = { ...context, readings: usableReadings(context) };
  return LITURGICAL_MOMENTS.map(({ id: moment }) => {
    const forMoment = candidates.filter((candidate) => candidate.liturgy.moments.includes(moment));
    const diagnosis: MomentDiagnosis = { moment, classified: forMoment.length, eligible: 0, reviewed: 0, withChordPro: 0, discarded: {} };
    for (const candidate of forMoment) {
      const result = checkEligibility(recommendationContext, moment, candidate.liturgy);
      if (result.eligible) {
        diagnosis.eligible += 1;
        diagnosis.reviewed += candidate.liturgy.reviewStatus === "reviewed" ? 1 : 0;
        diagnosis.withChordPro += candidate.hasChordPro ? 1 : 0;
      } else {
        diagnosis.discarded[result.rule] = (diagnosis.discarded[result.rule] ?? 0) + 1;
      }
    }
    return diagnosis;
  });
}

