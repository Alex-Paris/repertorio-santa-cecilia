import {
  missingClassificationParts,
  type SongClassification,
} from "@/features/liturgy/domain/classification";
import { isMassCategory, seasonLabel } from "@/features/liturgy/domain/vocabulary";

import type { CatalogStatus } from "./catalog-song";

export const QUALITY_ISSUES = [
  "unclassified",
  "no-moments",
  "no-rationale",
  "incomplete",
  "contradictory",
  "unreviewed",
  "disputed",
  "not-recommendable",
] as const;
export type QualityIssueCode = (typeof QUALITY_ISSUES)[number];

export const QUALITY_ISSUE_LABELS: Record<QualityIssueCode, string> = {
  unclassified: "Sem classificação",
  "no-moments": "Sem momento litúrgico",
  "no-rationale": "Sem justificativa editorial",
  incomplete: "Classificação incompleta",
  contradictory: "Classificação contraditória",
  unreviewed: "Justificativa não conferida",
  disputed: "Divergência editorial",
  "not-recommendable": "Publicada, mas sem classificação suficiente para sugestões",
};

/** Situação editorial de uma música, do ponto de vista das sugestões para a missa. */
export const READINESS = ["unclassified", "incomplete", "unreviewed", "disputed", "not-for-mass", "ready"] as const;
export type Readiness = (typeof READINESS)[number];

export const READINESS_LABELS: Record<Readiness, string> = {
  unclassified: "Sem classificação",
  incomplete: "Classificação incompleta",
  unreviewed: "Classificação não conferida",
  disputed: "Com divergência editorial",
  "not-for-mass": "Classificada fora da missa",
  ready: "Pronta para recomendação",
};

export interface QualityIssue {
  code: QualityIssueCode;
  detail: string;
}

export interface QualitySubject {
  status: CatalogStatus;
  liturgy: SongClassification | null;
}

/** Contradições internas: a classificação diz duas coisas incompatíveis ou nunca pode valer. */
export function findContradictions(liturgy: SongClassification): string[] {
  const found: string[] = [];
  const both = liturgy.seasons.filter((season) => liturgy.avoidSeasons.includes(season));
  if (both.length > 0) {
    found.push(`Indicada e restrita no mesmo tempo: ${both.map(seasonLabel).join(", ")}.`);
  }
  if (!isMassCategory(liturgy.category) && liturgy.moments.length > 0) {
    found.push("Canto que não é para a missa, mas com momentos da missa marcados.");
  }
  return found;
}

/**
 * Situação editorial. "Pronta" exige classificação completa, para a missa e conferida por uma
 * pessoa da equipe. Classificação importada ou recém-salva nunca é "pronta" sozinha.
 */
export function assessReadiness(liturgy: SongClassification | null): Readiness {
  if (!liturgy) {
    return "unclassified";
  }
  if (liturgy.reviewStatus === "disputed") {
    return "disputed";
  }
  if (missingClassificationParts(liturgy).length > 0 || findContradictions(liturgy).length > 0) {
    return "incomplete";
  }
  if (!isMassCategory(liturgy.category)) {
    return "not-for-mass";
  }
  return liturgy.reviewStatus === "reviewed" ? "ready" : "unreviewed";
}

/** Pode entrar nas sugestões: classificação para a missa, com momento, sem contradição nem divergência. */
export function isRecommendable(song: QualitySubject): boolean {
  const { liturgy } = song;
  return (
    song.status === "published" &&
    liturgy !== null &&
    liturgy.reviewStatus !== "disputed" &&
    isMassCategory(liturgy.category) &&
    liturgy.moments.length > 0 &&
    findContradictions(liturgy).length === 0
  );
}

/**
 * Pontos a revisar numa música do catálogo. Só aponta: nada é preenchido automaticamente, e
 * nem o título nem a letra são usados para adivinhar uma classificação.
 */
export function assessCatalogSong(song: QualitySubject): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const { liturgy } = song;

  if (!liturgy) {
    issues.push({ code: "unclassified", detail: "Ainda não foi classificada pela administração." });
  } else {
    if (liturgy.moments.length === 0) {
      issues.push({
        code: "no-moments",
        detail: isMassCategory(liturgy.category)
          ? "Canto litúrgico sem momento da missa."
          : "Não é indicada para nenhum momento da missa (canto devocional ou de uso geral).",
      });
    }
    if (!liturgy.editorialRationale.trim()) {
      issues.push({ code: "no-rationale", detail: "A classificação não registra a justificativa editorial." });
    }
    const missing = missingClassificationParts(liturgy).filter(
      (part) => part !== "justificativa editorial" && part !== "momento da missa",
    );
    if (missing.length > 0) {
      issues.push({ code: "incomplete", detail: `Falta: ${missing.join(", ")}.` });
    }
    for (const detail of findContradictions(liturgy)) {
      issues.push({ code: "contradictory", detail });
    }
    if (liturgy.reviewStatus === "disputed") {
      issues.push({ code: "disputed", detail: "Há uma divergência registrada; a música não entra nas sugestões." });
    } else if (liturgy.reviewStatus !== "reviewed") {
      issues.push({ code: "unreviewed", detail: "Ninguém da equipe conferiu esta classificação na fonte." });
    }
  }

  if (song.status === "published" && !isRecommendable(song)) {
    issues.push({ code: "not-recommendable", detail: "Aparece no catálogo, mas não entra nas sugestões para a missa." });
  }
  return issues;
}
