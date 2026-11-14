import { z } from "zod";

import {
  sameScriptureReference,
  scriptureReferenceSchema,
  type ScriptureReference,
} from "./scripture";
import {
  BIBLICAL_THEME_IDS,
  LITURGICAL_CELEBRATION_IDS,
  LITURGICAL_MOMENT_IDS,
  LITURGICAL_SEASON_IDS,
  SONG_USE_CATEGORY_IDS,
  isMassCategory,
  type BiblicalThemeId,
  type LiturgicalCelebrationId,
  type LiturgicalMomentId,
  type LiturgicalSeasonId,
  type SongUseCategory,
} from "./vocabulary";

export const MAX_SCRIPTURE_REFERENCES = 12;
export const MAX_SUITABILITY_NOTES_LENGTH = 1000;
export const MAX_EDITORIAL_RATIONALE_LENGTH = 2000;
export const MAX_OFFICIAL_REFERENCE_LENGTH = 500;
export const MAX_GUIDANCE_SOURCE_LENGTH = 500;
export const MAX_CLASSIFICATION_NOTE_LENGTH = 1000;

/**
 * Classificação litúrgica de uma música do catálogo, feita pela administração. Uma música
 * pode servir a vários momentos, tempos, celebrações e temas ao mesmo tempo. Pode ser salva
 * incompleta: só a classificação completa e conferida por uma pessoa é "pronta".
 */
export interface SongClassificationInput {
  category: SongUseCategory;
  moments: LiturgicalMomentId[];
  /** Tempos para os quais a música é indicada. Vazio: não é própria de nenhum tempo. */
  seasons: LiturgicalSeasonId[];
  celebrations: LiturgicalCelebrationId[];
  themes: BiblicalThemeId[];
  scripture: ScriptureReference[];
  /** Restrição: tempos em que a música não deve ser sugerida. */
  avoidSeasons: LiturgicalSeasonId[];
  /** Orientação de uso, visível a quem consulta o catálogo. */
  suitabilityNotes: string;
  /** Justificativa interna da classificação. Nunca sai da administração. */
  editorialRationale: string;
  /** Fonte que orientou a classificação (subsídio, hinário, rubrica). Pública. */
  guidanceSource: string;
  /** Só com evidência específica: documento oficial que indica o uso deste canto. */
  officialReference: string;
}

/** Situação da classificação. `reviewed` só por uma pessoa da administração, com a fonte conferida. */
export const CLASSIFICATION_REVIEW_STATUSES = ["pending_review", "reviewed", "disputed"] as const;
export type ClassificationReviewStatus = (typeof CLASSIFICATION_REVIEW_STATUSES)[number];

export const CLASSIFICATION_REVIEW_LABELS: Record<ClassificationReviewStatus, string> = {
  pending_review: "Classificação não conferida",
  reviewed: "Classificação conferida",
  disputed: "Classificação com divergência",
};

export interface ClassificationReview {
  by: string;
  at: string;
  /** O que a pessoa consultou para conferir a classificação. */
  source: string;
}

export interface ClassificationDispute {
  /** Interna: nunca sai da administração. */
  note: string;
  by: string;
  at: string;
}

export type SongClassification = SongClassificationInput & {
  classifiedBy: string;
  classifiedAt: string;
  reviewStatus: ClassificationReviewStatus;
  review: ClassificationReview | null;
  dispute: ClassificationDispute | null;
};

/** O que qualquer pessoa pode ver: sem justificativa interna, autoria ou nota de divergência. */
export type PublicSongClassification = Omit<SongClassificationInput, "editorialRationale" | "guidanceSource"> & {
  guidanceSource?: string;
  reviewStatus?: ClassificationReviewStatus;
  /** Data e fonte da conferência, quando conferida. */
  review?: { at: string; source: string };
};

function uniqueList<T extends string>(values: [T, ...T[]], max: number) {
  return z
    .array(z.enum(values))
    .max(max)
    .refine((list) => new Set(list).size === list.length, "Há itens repetidos.");
}

const scriptureList = z
  .array(scriptureReferenceSchema)
  .max(MAX_SCRIPTURE_REFERENCES, `Use no máximo ${MAX_SCRIPTURE_REFERENCES} referências bíblicas.`)
  .refine(
    (list) => list.every((reference, index) => !list.slice(0, index).some((other) => sameScriptureReference(other, reference))),
    "Há referências bíblicas repetidas.",
  );

const text = (max: number, message: string) => z.string().trim().max(max, message);

const publicFields = {
  category: z.enum(SONG_USE_CATEGORY_IDS, { error: "Escolha o tipo de uso." }),
  moments: uniqueList(LITURGICAL_MOMENT_IDS, LITURGICAL_MOMENT_IDS.length),
  seasons: uniqueList(LITURGICAL_SEASON_IDS, LITURGICAL_SEASON_IDS.length),
  celebrations: uniqueList(LITURGICAL_CELEBRATION_IDS, LITURGICAL_CELEBRATION_IDS.length),
  themes: uniqueList(BIBLICAL_THEME_IDS, BIBLICAL_THEME_IDS.length),
  scripture: scriptureList,
  avoidSeasons: uniqueList(LITURGICAL_SEASON_IDS, LITURGICAL_SEASON_IDS.length),
  suitabilityNotes: text(MAX_SUITABILITY_NOTES_LENGTH, `As observações devem ter no máximo ${MAX_SUITABILITY_NOTES_LENGTH} caracteres.`),
  officialReference: text(MAX_OFFICIAL_REFERENCE_LENGTH, `A fonte oficial deve ter no máximo ${MAX_OFFICIAL_REFERENCE_LENGTH} caracteres.`),
};

/**
 * Regras da classificação, para o formulário e o servidor. Dados incoerentes são recusados;
 * dados incompletos são aceitos e aparecem no relatório de qualidade.
 */
export const songClassificationInputSchema: z.ZodType<SongClassificationInput> = z
  .strictObject({
    ...publicFields,
    editorialRationale: text(MAX_EDITORIAL_RATIONALE_LENGTH, `A justificativa deve ter no máximo ${MAX_EDITORIAL_RATIONALE_LENGTH} caracteres.`),
    guidanceSource: text(MAX_GUIDANCE_SOURCE_LENGTH, `A fonte de orientação deve ter no máximo ${MAX_GUIDANCE_SOURCE_LENGTH} caracteres.`),
  })
  .refine((value) => isMassCategory(value.category) || value.moments.length === 0, {
    message: "Só cantos litúrgicos podem ser indicados para momentos da missa.",
    path: ["moments"],
  })
  .refine((value) => !value.seasons.some((season) => value.avoidSeasons.includes(season)), {
    message: "O mesmo tempo não pode ser indicado e restrito.",
    path: ["avoidSeasons"],
  });

/** O que falta para a classificação ficar completa. Vazio: completa. */
export function missingClassificationParts(value: SongClassificationInput): string[] {
  const missing: string[] = [];
  if (isMassCategory(value.category) && value.moments.length === 0) {
    missing.push("momento da missa");
  }
  if (value.category === "proper-text" && value.celebrations.length + value.scripture.length === 0) {
    missing.push("celebração ou passagem a que o texto próprio pertence");
  }
  if (value.moments.includes("salmo-responsorial") && value.scripture.length === 0) {
    missing.push("referência bíblica do salmo");
  }
  if (!value.editorialRationale.trim()) {
    missing.push("justificativa editorial");
  }
  if (!value.guidanceSource.trim()) {
    missing.push("fonte de orientação");
  }
  return missing;
}

const reviewSchema = z.strictObject({ by: z.string(), at: z.iso.datetime(), source: z.string() });
const disputeSchema = z.strictObject({ note: z.string(), by: z.string(), at: z.iso.datetime() });

export const publicSongClassificationSchema: z.ZodType<PublicSongClassification> = z.strictObject({
  ...publicFields,
  guidanceSource: z.string().optional(),
  reviewStatus: z.enum(CLASSIFICATION_REVIEW_STATUSES).optional(),
  review: z.strictObject({ at: z.iso.datetime(), source: z.string() }).optional(),
});

export const songClassificationSchema: z.ZodType<SongClassification> = z.strictObject({
  ...publicFields,
  editorialRationale: z.string(),
  guidanceSource: z.string(),
  classifiedBy: z.string(),
  classifiedAt: z.iso.datetime(),
  reviewStatus: z.enum(CLASSIFICATION_REVIEW_STATUSES),
  review: reviewSchema.nullable(),
  dispute: disputeSchema.nullable(),
});

export function toPublicClassification(classification: SongClassification): PublicSongClassification {
  const { category, moments, seasons, celebrations, themes, scripture, avoidSeasons, suitabilityNotes, officialReference } =
    classification;
  return {
    category,
    moments,
    seasons,
    celebrations,
    themes,
    scripture,
    avoidSeasons,
    suitabilityNotes,
    officialReference,
    ...(classification.guidanceSource.trim() ? { guidanceSource: classification.guidanceSource } : {}),
    reviewStatus: classification.reviewStatus,
    ...(classification.reviewStatus === "reviewed" && classification.review
      ? { review: { at: classification.review.at, source: classification.review.source } }
      : {}),
  };
}

export const EMPTY_CLASSIFICATION_INPUT: SongClassificationInput = {
  category: "liturgical",
  moments: [],
  seasons: [],
  celebrations: [],
  themes: [],
  scripture: [],
  avoidSeasons: [],
  suitabilityNotes: "",
  editorialRationale: "",
  guidanceSource: "",
  officialReference: "",
};

/** Conferir, registrar divergência ou resolvê-la. Editar a classificação sempre volta a "não conferida". */
export const classificationReviewRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("approve"),
    humanReviewConfirmed: z.literal(true, { error: "Confirme que você conferiu a classificação." }),
    source: z.string().trim().min(1, "Informe a fonte que você consultou.").max(MAX_GUIDANCE_SOURCE_LENGTH),
  }),
  z.strictObject({
    action: z.literal("dispute"),
    note: z.string().trim().min(1, "Descreva a divergência.").max(MAX_CLASSIFICATION_NOTE_LENGTH),
  }),
  z.strictObject({
    action: z.literal("resolve"),
    note: z.string().trim().min(1, "Registre como a divergência foi resolvida.").max(MAX_CLASSIFICATION_NOTE_LENGTH),
  }),
]);

export type ClassificationReviewRequest = z.infer<typeof classificationReviewRequestSchema>;

/** Próximo estado, ou o motivo da recusa. A conferência exige classificação completa. */
export function nextClassificationStatus(
  classification: SongClassification,
  request: ClassificationReviewRequest,
): { ok: true; status: ClassificationReviewStatus } | { ok: false; message: string } {
  const { reviewStatus } = classification;
  if (request.action === "approve") {
    if (reviewStatus === "disputed") {
      return { ok: false, message: "Resolva a divergência antes de conferir a classificação." };
    }
    const missing = missingClassificationParts(classification);
    if (missing.length > 0) {
      return { ok: false, message: `A classificação está incompleta: falta ${missing.join(", ")}.` };
    }
    return { ok: true, status: "reviewed" };
  }
  if (request.action === "dispute") {
    return reviewStatus === "disputed"
      ? { ok: false, message: "A classificação já está com divergência." }
      : { ok: true, status: "disputed" };
  }
  return reviewStatus === "disputed"
    ? { ok: true, status: "pending_review" }
    : { ok: false, message: "Não há divergência a resolver." };
}
