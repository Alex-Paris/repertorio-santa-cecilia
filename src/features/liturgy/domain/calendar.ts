import type { ScriptureReference } from "./scripture";
import type {
  BiblicalThemeId,
  LiturgicalCelebrationId,
  LiturgicalColor,
  LiturgicalSeasonId,
} from "./vocabulary";

/** Calendário do Rito Romano em uso no Brasil. Outros calendários entram como novos valores. */
export const DEFAULT_CALENDAR = "rito-romano-brasil";
export const DEFAULT_LOCALE = "pt-BR";
export const DEFAULT_COUNTRY = "BR";

export type LiturgicalCalendarId = typeof DEFAULT_CALENDAR;

export const CELEBRATION_RANKS = ["solenidade", "festa", "domingo", "memoria", "memoria-facultativa", "feria"] as const;
export type CelebrationRank = (typeof CELEBRATION_RANKS)[number];

export const CELEBRATION_RANK_LABELS: Record<CelebrationRank, string> = {
  solenidade: "Solenidade",
  festa: "Festa",
  domingo: "Domingo",
  memoria: "Memória",
  "memoria-facultativa": "Memória facultativa",
  feria: "Dia de semana",
};

export const READING_ROLES = ["first", "psalm", "second", "gospel"] as const;
export type ReadingRole = (typeof READING_ROLES)[number];

export const READING_ROLE_LABELS: Record<ReadingRole, string> = {
  first: "1ª leitura",
  psalm: "Salmo responsorial",
  second: "2ª leitura",
  gospel: "Evangelho",
};

/** Abrangência da celebração no calendário. */
export const CELEBRATION_SCOPES = ["universal", "national", "diocesan"] as const;
export type CelebrationScope = (typeof CELEBRATION_SCOPES)[number];

export const CELEBRATION_SCOPE_LABELS: Record<CelebrationScope, string> = {
  universal: "Calendário romano geral",
  national: "Calendário do Brasil",
  diocesan: "Calendário diocesano",
};

/**
 * Formulário da missa. Uma data pode ter mais de um: o Natal tem quatro, e uma solenidade
 * pode ter missa da vigília. A missa vespertina antecipada não é um formulário próprio.
 */
export const MASS_VARIANTS = ["principal", "vigilia", "noite", "aurora", "dia"] as const;
export type MassVariant = (typeof MASS_VARIANTS)[number];

export const MASS_VARIANT_LABELS: Record<MassVariant, string> = {
  principal: "Missa do dia",
  vigilia: "Missa da Vigília",
  noite: "Missa da Noite",
  aurora: "Missa da Aurora",
  dia: "Missa do Dia",
};

export const SUNDAY_CYCLES = ["A", "B", "C"] as const;
export const WEEKDAY_CYCLES = ["I", "II"] as const;

/** Ciclos do Lecionário. O ferial não se aplica a domingos e solenidades. */
export interface LectionaryCycle {
  sunday: (typeof SUNDAY_CYCLES)[number];
  weekday: (typeof WEEKDAY_CYCLES)[number] | null;
}

/** Só a referência: o texto das leituras não é copiado para a plataforma. */
export interface LiturgicalReading {
  role: ReadingRole;
  /** Citação como aparece no Lecionário, com as subdivisões dos versículos. */
  citation: string;
  /** Mesma passagem em forma comparável com as referências das músicas. */
  ranges: ScriptureReference[];
}

/**
 * Fatos que uma fonte pode confirmar. A proveniência de cada um é calculada a partir das
 * fontes registradas: o que nenhuma fonte confirma é inferência, e a interface diz isso.
 */
export const FACT_FIELDS = ["title", "rank", "season", "color", "cycle", ...READING_ROLES] as const;
export type FactField = (typeof FACT_FIELDS)[number];

export const FACT_FIELD_LABELS: Record<FactField, string> = {
  title: "Título",
  rank: "Grau",
  season: "Tempo litúrgico",
  color: "Cor litúrgica",
  cycle: "Ciclo do Lecionário",
  ...READING_ROLE_LABELS,
};

/** Fatos de calendário: só uma fonte do Brasil ou universal pode confirmá-los. */
export const CALENDAR_FACTS: readonly FactField[] = ["title", "rank", "season", "color", "cycle"];

/** De onde a fonte fala. Calendário de outro país nunca confirma o calendário do Brasil. */
export const SOURCE_JURISDICTIONS = ["BR", "universal", "other-country"] as const;
export type SourceJurisdiction = (typeof SOURCE_JURISDICTIONS)[number];

export const SOURCE_JURISDICTION_LABELS: Record<SourceJurisdiction, string> = {
  BR: "Fonte do Brasil",
  universal: "Fonte universal",
  "other-country": "Fonte de outro país",
};

/** Como a fonte foi conferida contra o registro. */
export const SOURCE_VERIFICATIONS = ["automated-comparison", "human-check"] as const;
export type SourceVerification = (typeof SOURCE_VERIFICATIONS)[number];

export const SOURCE_VERIFICATION_LABELS: Record<SourceVerification, string> = {
  "automated-comparison": "Comparação automatizada",
  "human-check": "Conferida por pessoa",
};

/** Fonte consultada, com o que ela confirma. Pública: não tem nada interno. */
export interface CelebrationSource {
  /** Identificador estável dentro da celebração, citado nas aprovações. */
  id: string;
  provider: string;
  documentTitle: string;
  referenceUrl?: string;
  edition?: string;
  /** Data da consulta, `AAAA-MM-DD`. */
  accessedAt: string;
  jurisdiction: SourceJurisdiction;
  /** Fatos que esta fonte confirma. */
  scope: FactField[];
  verificationStatus: SourceVerification;
  note?: string;
}

/** Estado editorial. Só uma pessoa da administração leva uma celebração a `reviewed`. */
export const REVIEW_STATUSES = ["pending_review", "reviewed", "disputed", "needs_update"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending_review: "Em revisão",
  reviewed: "Revisada",
  disputed: "Com divergência",
  needs_update: "Em atualização",
};

export type FactProvenance =
  | { field: FactField; status: "source"; sourceIds: string[] }
  /** Regra geral (por exemplo, a cor do tempo) ou dado sem fonte que o confirme. */
  | { field: FactField; status: "inference" }
  /** A celebração tem esta leitura, mas ela não foi conferida. */
  | { field: FactField; status: "missing" };

/**
 * Contexto da celebração, como qualquer pessoa o vê. Não pertence a nenhum usuário e não
 * leva dados internos da administração (autoria, notas de divergência, histórico).
 */
export interface LiturgicalCelebrationContext {
  /** Identificador estável. Nunca é o título. */
  celebrationId: string;
  /** Data civil, `AAAA-MM-DD`, sem horário nem fuso. */
  date: string;
  locale: typeof DEFAULT_LOCALE;
  calendar: LiturgicalCalendarId;
  country: typeof DEFAULT_COUNTRY;
  scope: CelebrationScope;
  diocese?: string;
  celebrationKey: string;
  massVariant: MassVariant;
  title: string;
  rank: CelebrationRank;
  season: LiturgicalSeasonId;
  lectionaryCycle: LectionaryCycle;
  /** `source`: confirmada por fonte. `rule`: regra geral da IGMR 346 para o tempo ou o grau. */
  liturgicalColor: { color: LiturgicalColor; basis: "source" | "rule"; note?: string } | null;
  /** Leituras com fonte. Uma leitura ausente daqui não foi conferida e não é exibida. */
  readings: LiturgicalReading[];
  /** Leituras que a celebração tem, mas que não foram conferidas. */
  unverifiedReadings: ReadingRole[];
  /** Celebrações do vocabulário a que esta data corresponde, para cantos próprios. */
  celebrations: LiturgicalCelebrationId[];
  /** Interpretação editorial do Repertório Web, a partir das leituras. Não vem da fonte. */
  biblicalThemes: BiblicalThemeId[];
  /** Observações editoriais. */
  notes: string[];
  sources: CelebrationSource[];
  provenance: FactProvenance[];
  review: {
    status: ReviewStatus;
    /** Data da aprovação em vigor, quando revisada. */
    reviewedAt: string | null;
    /** Fatos em divergência, quando houver. A nota da divergência é interna. */
    disputedFields: FactField[];
  };
  /** Revisão do documento: muda a cada alteração, inclusive de estado. */
  revision: number;
  updatedAt: string;
}

/** Resumo para listas e buscas. */
export type CelebrationSummary = Pick<
  LiturgicalCelebrationContext,
  "celebrationId" | "date" | "title" | "massVariant" | "season" | "rank" | "scope" | "diocese" | "revision"
> & { reviewStatus: ReviewStatus; color: LiturgicalColor | null };

export const MAX_CELEBRATION_PAGE_SIZE = 50;
export const DEFAULT_CELEBRATION_PAGE_SIZE = 12;
/** Uma consulta por período cobre no máximo um ano. */
export const MAX_CELEBRATION_RANGE_DAYS = 366;

export interface CelebrationQuery {
  from?: string;
  to?: string;
  q?: string;
  season?: LiturgicalSeasonId;
  status?: ReviewStatus;
  /** Inclui a particularidade desta diocese, além do calendário nacional e universal. */
  diocese?: string;
  page: number;
  pageSize: number;
}

export interface CelebrationPage {
  celebrations: CelebrationSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Fonte de contextos litúrgicos. Hoje, a base editorial no MongoDB; uma API verificada pode
 * entrar depois sem mudar quem consome. Nunca devolve dados estimados.
 */
export interface LiturgicalCalendarProvider {
  readonly id: string;
  readonly calendar: LiturgicalCalendarId;
  /** Todas as celebrações da data (variantes e particularidades), em ordem estável. */
  getByDate(date: string, options?: { diocese?: string }): Promise<LiturgicalCelebrationContext[]>;
  getById(celebrationId: string): Promise<LiturgicalCelebrationContext | null>;
  search(query: CelebrationQuery): Promise<CelebrationPage>;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Aceita somente datas civis reais no formato `AAAA-MM-DD`. */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const match = ISO_DATE.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1970 &&
    year <= 2200 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Dias entre duas datas civis, sem passar por fuso horário. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Soma dias a uma data civil. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Data civil de hoje no Brasil: nunca a data UTC, que muda à noite. */
export function todayInBrazil(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

const LONG_DATE = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const SHORT_DATE = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "domingo, 15 de novembro de 2026". A data é civil: não depende de fuso horário. */
export function formatLongDate(date: string): string {
  return LONG_DATE.format(new Date(`${date}T00:00:00.000Z`));
}

/** "15 de novembro de 2026". */
export function formatShortDate(date: string): string {
  return SHORT_DATE.format(new Date(`${date}T00:00:00.000Z`));
}

/** Endereço da liturgia do dia em fonte externa, para datas fora da cobertura. */
export function externalLiturgyUrl(date: string): string {
  const [year, month, day] = date.split("-");
  return `https://www.vaticannews.va/pt/palavra-do-dia/${year}/${month}/${day}.html`;
}

/** "Natal do Senhor — Missa da Noite"; o formulário principal não muda o título. */
export function celebrationDisplayTitle(entry: Pick<LiturgicalCelebrationContext, "title" | "massVariant">): string {
  return entry.massVariant === "principal" ? entry.title : `${entry.title} — ${MASS_VARIANT_LABELS[entry.massVariant]}`;
}
