import { z } from "zod";

import { isSafeExternalUrl } from "@/lib/utils/is-safe-external-url";

import {
  CALENDAR_FACTS,
  CELEBRATION_RANKS,
  CELEBRATION_SCOPES,
  DEFAULT_CALENDAR,
  DEFAULT_COUNTRY,
  DEFAULT_LOCALE,
  FACT_FIELDS,
  MASS_VARIANTS,
  READING_ROLES,
  REVIEW_STATUSES,
  SOURCE_JURISDICTIONS,
  SOURCE_VERIFICATIONS,
  SUNDAY_CYCLES,
  WEEKDAY_CYCLES,
  isValidIsoDate,
  type CelebrationRank,
  type CelebrationScope,
  type CelebrationSource,
  type CelebrationSummary,
  type FactField,
  type FactProvenance,
  type LectionaryCycle,
  type LiturgicalCelebrationContext,
  type LiturgicalReading,
  type MassVariant,
  type ReadingRole,
  type ReviewStatus,
} from "./calendar";
import { scriptureReferenceSchema } from "./scripture";
import {
  BIBLICAL_THEME_IDS,
  LITURGICAL_CELEBRATION_IDS,
  LITURGICAL_COLORS,
  LITURGICAL_SEASON_IDS,
  type BiblicalThemeId,
  type LiturgicalCelebrationId,
  type LiturgicalColor,
  type LiturgicalSeasonId,
} from "./vocabulary";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const MAX_CELEBRATION_SOURCES = 10;
export const MAX_CELEBRATION_NOTES = 10;
export const MAX_NOTE_LENGTH = 500;
export const MAX_REVIEW_NOTE_LENGTH = 1000;

/** Conteúdo editável de uma celebração: tudo que a administração informa. */
export interface CelebrationInput {
  date: string;
  country: typeof DEFAULT_COUNTRY;
  scope: CelebrationScope;
  /** Obrigatória só em celebração diocesana. */
  diocese?: string;
  /** Identifica a celebração no calendário (ex.: `cristo-rei`). Não é o título. */
  celebrationKey: string;
  massVariant: MassVariant;
  title: string;
  rank: CelebrationRank;
  season: LiturgicalSeasonId;
  lectionaryCycle: LectionaryCycle;
  liturgicalColor: { color: LiturgicalColor; note?: string } | null;
  readings: LiturgicalReading[];
  unverifiedReadings: ReadingRole[];
  celebrations: LiturgicalCelebrationId[];
  biblicalThemes: BiblicalThemeId[];
  notes: string[];
  sources: CelebrationSource[];
}

/** Aprovação em vigor: só existe enquanto a celebração está revisada. */
export interface CelebrationApproval {
  by: string;
  at: string;
  /** Revisão do conteúdo que a pessoa conferiu e aprovou. */
  revision: number;
  /** Fontes que fundamentaram a aprovação. */
  sourceIds: string[];
}

export interface CelebrationDispute {
  fields: FactField[];
  /** Interna: nunca sai da administração. */
  note: string;
  by: string;
  at: string;
}

/** Celebração como a administração a vê. */
export type CelebrationRecord = CelebrationInput & {
  id: string;
  reviewStatus: ReviewStatus;
  approval: CelebrationApproval | null;
  dispute: CelebrationDispute | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

const unique = <T>(list: readonly T[]) => new Set(list).size === list.length;

const sourceSchema: z.ZodType<CelebrationSource> = z
  .strictObject({
    id: z.string().regex(SLUG, "Identificador de fonte inválido.").max(40),
    provider: z.string().trim().min(1, "Informe quem publica a fonte.").max(200),
    documentTitle: z.string().trim().min(1, "Informe o título do documento.").max(300),
    referenceUrl: z.string().trim().max(2048).refine(isSafeExternalUrl, "Use um endereço http(s).").optional(),
    edition: z.string().trim().min(1).max(200).optional(),
    accessedAt: z.string().refine(isValidIsoDate, "Informe a data da consulta."),
    jurisdiction: z.enum(SOURCE_JURISDICTIONS),
    scope: z
      .array(z.enum(FACT_FIELDS))
      .min(1, "Indique o que esta fonte confirma.")
      .refine(unique, "Há itens repetidos no que a fonte confirma."),
    verificationStatus: z.enum(SOURCE_VERIFICATIONS),
    note: z.string().trim().min(1).max(MAX_NOTE_LENGTH).optional(),
  })
  .refine(
    (source) => source.jurisdiction !== "other-country" || !source.scope.some((field) => CALENDAR_FACTS.includes(field)),
    {
      message: "Uma fonte de outro país só pode confirmar referências de leituras, nunca o calendário do Brasil.",
      path: ["scope"],
    },
  );

const readingSchema: z.ZodType<LiturgicalReading> = z.strictObject({
  role: z.enum(READING_ROLES),
  citation: z.string().trim().min(1, "Informe a citação.").max(120),
  ranges: z.array(scriptureReferenceSchema).min(1, "Informe ao menos um trecho bíblico.").max(6),
});

function uniqueEnumList<T extends string>(values: readonly [T, ...T[]]) {
  return z.array(z.enum(values)).refine(unique, "Há itens repetidos.");
}

/** Regras do conteúdo: fonte única para o formulário, a importação e o servidor. */
export const celebrationInputSchema: z.ZodType<CelebrationInput> = z
  .strictObject({
    date: z.string().refine(isValidIsoDate, "Informe uma data válida (AAAA-MM-DD)."),
    country: z.literal(DEFAULT_COUNTRY),
    scope: z.enum(CELEBRATION_SCOPES),
    diocese: z.string().regex(SLUG, "Identificador de diocese inválido.").max(80).optional(),
    celebrationKey: z
      .string({ error: "Informe a chave da celebração." })
      .regex(SLUG, "Use letras minúsculas, números e hífens na chave da celebração.")
      .max(80),
    massVariant: z.enum(MASS_VARIANTS),
    title: z.string().trim().min(1, "Informe o título.").max(300),
    rank: z.enum(CELEBRATION_RANKS),
    season: z.enum(LITURGICAL_SEASON_IDS),
    lectionaryCycle: z.strictObject({
      sunday: z.enum(SUNDAY_CYCLES),
      weekday: z.enum(WEEKDAY_CYCLES).nullable(),
    }),
    liturgicalColor: z
      .strictObject({ color: z.enum(LITURGICAL_COLORS), note: z.string().trim().min(1).max(MAX_NOTE_LENGTH).optional() })
      .nullable(),
    readings: z.array(readingSchema).max(READING_ROLES.length),
    unverifiedReadings: uniqueEnumList(READING_ROLES),
    celebrations: uniqueEnumList(LITURGICAL_CELEBRATION_IDS),
    biblicalThemes: uniqueEnumList(BIBLICAL_THEME_IDS),
    notes: z.array(z.string().trim().min(1).max(MAX_NOTE_LENGTH)).max(MAX_CELEBRATION_NOTES),
    sources: z
      .array(sourceSchema)
      .min(1, "Registre ao menos uma fonte.")
      .max(MAX_CELEBRATION_SOURCES)
      .refine((sources) => unique(sources.map((source) => source.id)), "Há fontes com o mesmo identificador."),
  })
  .refine((value) => (value.scope === "diocesan") === (value.diocese !== undefined), {
    message: "Informe a diocese somente em celebrações diocesanas.",
    path: ["diocese"],
  })
  .refine((value) => unique(value.readings.map((reading) => reading.role)), {
    message: "Cada leitura aparece uma só vez.",
    path: ["readings"],
  })
  .refine((value) => !value.readings.some((reading) => value.unverifiedReadings.includes(reading.role)), {
    message: "Uma leitura não pode estar registrada e marcada como não conferida.",
    path: ["unverifiedReadings"],
  })
  .refine(
    // Uma leitura registrada é fato: precisa de uma fonte que a confirme. Sem fonte, ela é "não conferida".
    (value) => value.readings.every((reading) => value.sources.some((source) => source.scope.includes(reading.role))),
    { message: "Toda leitura registrada precisa de uma fonte que a confirme.", path: ["readings"] },
  )
  .refine((value) => value.lectionaryCycle.weekday === null || (value.rank !== "domingo" && value.rank !== "solenidade"), {
    message: "O ciclo ferial não se aplica a domingos e solenidades.",
    path: ["lectionaryCycle"],
  });

/** Fontes que podem confirmar um fato: calendário só por fonte do Brasil ou universal. */
function confirmingSources(sources: readonly CelebrationSource[], field: FactField): string[] {
  return sources
    .filter(
      (source) =>
        source.scope.includes(field) && (source.jurisdiction !== "other-country" || !CALENDAR_FACTS.includes(field)),
    )
    .map((source) => source.id);
}

/** De onde vem cada fato: fonte, inferência ou ausência. Leituras que a celebração não tem ficam de fora. */
export function computeProvenance(input: Pick<CelebrationInput, "sources" | "readings" | "unverifiedReadings" | "liturgicalColor">): FactProvenance[] {
  const result: FactProvenance[] = [];
  for (const field of FACT_FIELDS) {
    if (field === "color" && !input.liturgicalColor) {
      continue;
    }
    const isReading = (READING_ROLES as readonly string[]).includes(field);
    if (isReading) {
      if (input.unverifiedReadings.includes(field as ReadingRole)) {
        result.push({ field, status: "missing" });
        continue;
      }
      if (!input.readings.some((reading) => reading.role === field)) {
        continue;
      }
    }
    const sourceIds = confirmingSources(input.sources, field);
    result.push(sourceIds.length > 0 ? { field, status: "source", sourceIds } : { field, status: "inference" });
  }
  return result;
}

/** Projeção pública: sem autoria, nota de divergência, histórico ou campos de controle internos. */
export function toPublicCelebration(record: CelebrationRecord): LiturgicalCelebrationContext {
  const provenance = computeProvenance(record);
  const colorFromSource = provenance.some((entry) => entry.field === "color" && entry.status === "source");

  return {
    celebrationId: record.id,
    date: record.date,
    locale: DEFAULT_LOCALE,
    calendar: DEFAULT_CALENDAR,
    country: record.country,
    scope: record.scope,
    ...(record.diocese ? { diocese: record.diocese } : {}),
    celebrationKey: record.celebrationKey,
    massVariant: record.massVariant,
    title: record.title,
    rank: record.rank,
    season: record.season,
    lectionaryCycle: { ...record.lectionaryCycle },
    liturgicalColor: record.liturgicalColor
      ? {
          color: record.liturgicalColor.color,
          basis: colorFromSource ? "source" : "rule",
          ...(record.liturgicalColor.note ? { note: record.liturgicalColor.note } : {}),
        }
      : null,
    readings: record.readings.map((reading) => ({ ...reading, ranges: reading.ranges.map((range) => ({ ...range })) })),
    unverifiedReadings: [...record.unverifiedReadings],
    celebrations: [...record.celebrations],
    biblicalThemes: [...record.biblicalThemes],
    notes: [...record.notes],
    sources: record.sources.map((source) => ({ ...source, scope: [...source.scope] })),
    provenance,
    review: {
      status: record.reviewStatus,
      reviewedAt: record.reviewStatus === "reviewed" && record.approval ? record.approval.at : null,
      disputedFields: record.reviewStatus === "disputed" && record.dispute ? [...record.dispute.fields] : [],
    },
    revision: record.revision,
    updatedAt: record.updatedAt,
  };
}

export function toCelebrationSummary(
  record: Pick<
    CelebrationRecord,
    "id" | "date" | "title" | "massVariant" | "season" | "rank" | "scope" | "diocese" | "revision" | "reviewStatus" | "liturgicalColor"
  >,
): CelebrationSummary {
  return {
    celebrationId: record.id,
    date: record.date,
    title: record.title,
    massVariant: record.massVariant,
    season: record.season,
    rank: record.rank,
    scope: record.scope,
    ...(record.diocese ? { diocese: record.diocese } : {}),
    revision: record.revision,
    reviewStatus: record.reviewStatus,
    color: record.liturgicalColor?.color ?? null,
  };
}

/** Campos de conteúdo alterados entre duas versões, para o histórico. */
export function changedCelebrationFields(before: CelebrationInput, after: CelebrationInput): (keyof CelebrationInput)[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof CelebrationInput>;
  return [...keys]
    .filter((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null))
    .sort();
}

/** Só o conteúdo editável, na ordem do esquema, para comparações e para o histórico. */
export function pickCelebrationInput(record: CelebrationInput): CelebrationInput {
  return {
    date: record.date,
    country: record.country,
    scope: record.scope,
    ...(record.diocese ? { diocese: record.diocese } : {}),
    celebrationKey: record.celebrationKey,
    massVariant: record.massVariant,
    title: record.title,
    rank: record.rank,
    season: record.season,
    lectionaryCycle: record.lectionaryCycle,
    liturgicalColor: record.liturgicalColor,
    readings: record.readings,
    unverifiedReadings: record.unverifiedReadings,
    celebrations: record.celebrations,
    biblicalThemes: record.biblicalThemes,
    notes: record.notes,
    sources: record.sources,
  };
}

/** Nomes dos campos, para o histórico e as mensagens da administração. */
export const CELEBRATION_FIELD_LABELS: Record<keyof CelebrationInput, string> = {
  date: "Data",
  country: "País",
  scope: "Abrangência",
  diocese: "Diocese",
  celebrationKey: "Chave da celebração",
  massVariant: "Formulário da missa",
  title: "Título",
  rank: "Grau",
  season: "Tempo litúrgico",
  lectionaryCycle: "Ciclo do Lecionário",
  liturgicalColor: "Cor litúrgica",
  readings: "Leituras",
  unverifiedReadings: "Leituras não conferidas",
  celebrations: "Celebrações do vocabulário",
  biblicalThemes: "Temas editoriais",
  notes: "Observações",
  sources: "Fontes",
};

export { REVIEW_STATUSES };
