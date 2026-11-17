import { z } from "zod";

import { tokenize } from "@/features/catalog/domain/catalog-search";
import {
  BIBLICAL_THEME_IDS,
  LITURGICAL_CELEBRATION_IDS,
  LITURGICAL_MOMENT_IDS,
  LITURGICAL_SEASON_IDS,
  type BiblicalThemeId,
  type LiturgicalCelebrationId,
  type LiturgicalMomentId,
  type LiturgicalSeasonId,
} from "@/features/liturgy/domain/vocabulary";
import { MUSICAL_KEYS, type MusicalKey } from "@/features/songs/domain/musical-key";
import type { ContentType, IsoDateTime, Revision, Song } from "@/features/songs/domain/song";
import { entityIdSchema, revisionSchema } from "@/features/songs/domain/song-schema";
import { parseYouTubeId } from "@/features/songs/domain/video-reference";

/**
 * Contribuições ao catálogo (Etapa 2F.1). Uma proposta é um documento próprio: guarda a
 * versão enviada da música particular (que continua privada e editável) e as declarações
 * do colaborador. Nada é publicado sem a decisão de uma pessoa da administração.
 */

export const SUBMISSION_STATUSES = ["pending", "needs_changes", "approved", "rejected", "withdrawn"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: "Em análise",
  needs_changes: "Precisa de correções",
  approved: "Aprovada",
  rejected: "Recusada",
  withdrawn: "Retirada",
};

/** Situações em que a proposta ainda ocupa a fila e conta no limite de pendentes. */
export const ACTIVE_SUBMISSION_STATUSES = ["pending", "needs_changes"] as const satisfies readonly SubmissionStatus[];

export type SubmissionAction = "approve" | "reject" | "request_changes" | "withdraw" | "resubmit";

/**
 * Transições válidas. Aprovada, recusada e retirada são finais: uma proposta aprovada nunca
 * volta à fila nem gera outra publicação.
 */
const TRANSITIONS: Record<SubmissionStatus, Partial<Record<SubmissionAction, SubmissionStatus>>> = {
  pending: { approve: "approved", reject: "rejected", request_changes: "needs_changes", withdraw: "withdrawn" },
  needs_changes: { resubmit: "pending", reject: "rejected", withdraw: "withdrawn" },
  approved: {},
  rejected: {},
  withdrawn: {},
};

export function nextSubmissionStatus(current: SubmissionStatus, action: SubmissionAction): SubmissionStatus | null {
  return TRANSITIONS[current][action] ?? null;
}

export function isFinalSubmissionStatus(status: SubmissionStatus): boolean {
  return Object.keys(TRANSITIONS[status]).length === 0;
}

// ---------------------------------------------------------------------------------------------
// Versão enviada

/** Só o necessário para a análise editorial: nada da conta nem do repertório. */
export interface SubmissionSnapshot {
  title: string;
  artist: string;
  originalKey: MusicalKey;
  contentType: ContentType;
  chordPro?: string;
  sourceUrl?: string;
}

export function buildSubmissionSnapshot(song: Song): SubmissionSnapshot {
  const base = { title: song.title, artist: song.artist, originalKey: song.originalKey, contentType: song.contentType };
  if (song.contentType === "external-link") {
    return { ...base, sourceUrl: song.sourceUrl };
  }
  return { ...base, ...(song.chordPro?.trim() ? { chordPro: song.chordPro } : {}) };
}

export const submissionSnapshotSchema: z.ZodType<SubmissionSnapshot> = z.strictObject({
  title: z.string(),
  artist: z.string(),
  originalKey: z.enum(MUSICAL_KEYS),
  contentType: z.enum(["original", "authorized", "external-link"]),
  chordPro: z.string().optional(),
  sourceUrl: z.string().optional(),
});

// ---------------------------------------------------------------------------------------------
// Sugestões, vídeo, direitos e crédito

/** Classificação sugerida pelo colaborador. É sugestão: nunca vira classificação revisada sozinha. */
export interface SuggestedClassification {
  moments: LiturgicalMomentId[];
  seasons: LiturgicalSeasonId[];
  celebrations: LiturgicalCelebrationId[];
  themes: BiblicalThemeId[];
}

export const EMPTY_SUGGESTED_CLASSIFICATION: SuggestedClassification = { moments: [], seasons: [], celebrations: [], themes: [] };

export function hasSuggestedClassification(value: SuggestedClassification): boolean {
  return value.moments.length + value.seasons.length + value.celebrations.length + value.themes.length > 0;
}

export const VIDEO_KINDS = ["performance", "reference"] as const;
export type VideoKind = (typeof VIDEO_KINDS)[number];

/** Vídeo guardado de forma estruturada: provedor e identificador, nunca HTML ou endereço de iframe. */
export interface SubmissionVideo {
  provider: "youtube";
  videoId: string;
  title?: string;
  kind: VideoKind;
  /** "Este vídeo é uma apresentação minha." Declaração, não prova de titularidade. */
  ownPerformance: boolean;
}

export const RIGHTS_STATUSES = ["own-composition", "authorized", "public-domain", "third-party", "unknown"] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export const RIGHTS_STATUS_LABELS: Record<RightsStatus, string> = {
  "own-composition": "A composição é minha (letra e música)",
  authorized: "Tenho autorização de quem compôs",
  "public-domain": "A obra está em domínio público",
  "third-party": "A obra é de outra pessoa e não tenho autorização",
  unknown: "Não sei a situação dos direitos",
};

/** Só quem declara ser autor ou ter autorização pode conceder licença sobre a letra e a cifra. */
export function canLicenseContent(status: RightsStatus): boolean {
  return status === "own-composition" || status === "authorized";
}

/**
 * Versão do texto da declaração aceito pelo colaborador. Os termos ainda dependem de revisão
 * jurídica antes da abertura pública; mudar o texto exige uma nova versão.
 */
export const RIGHTS_DECLARATION_VERSION = "2026-11-contribuicao-v1";

export interface ContentLicense {
  /** Exibir a letra e a cifra no catálogo. */
  display: boolean;
  /** Reproduzir o conteúdo (leitura, apresentação, transposição). */
  reproduce: boolean;
  /** Incluir a cifra em links públicos de repertórios. */
  redistribute: boolean;
}

export interface RightsDeclaration {
  status: RightsStatus;
  /** Autorização não exclusiva, só quando o colaborador declara poder concedê-la. */
  license: ContentLicense;
  declarationVersion: string;
  acceptedAt: IsoDateTime;
  note?: string;
}

export const NO_LICENSE: ContentLicense = { display: false, reproduce: false, redistribute: false };

export interface PublicCreditPreference {
  show: boolean;
  /** Nome público escolhido pelo colaborador; nunca o nome da conta por padrão. */
  name?: string;
}

export const PUBLIC_NAME_MAX = 60;

/**
 * Nome público aceitável: texto curto, sem e-mail, endereço ou arroba. A moderação de nomes
 * ofensivos é da administração; aqui só se barra o que exporia dados ou links.
 */
export function publicNameProblem(name: string): string | null {
  const value = name.trim().replace(/\s+/g, " ");
  if (value.length < 2) return "Informe um nome público com pelo menos 2 caracteres.";
  if (value.length > PUBLIC_NAME_MAX) return `O nome público deve ter no máximo ${PUBLIC_NAME_MAX} caracteres.`;
  if (/@|https?:|www\.|\.(com|br|net|org)\b/i.test(value)) return "O nome público não pode conter e-mail nem endereço de site.";
  return null;
}

export function normalizePublicName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------------------------
// Entrada do colaborador

export const SUBMISSION_TEXT_MAX = 1000;

const uniqueList = <T extends string>(values: readonly [T, ...T[]], max: number) =>
  z
    .array(z.enum(values))
    .max(max)
    .refine((list) => new Set(list).size === list.length, "Há itens repetidos.");

export const suggestedClassificationSchema: z.ZodType<SuggestedClassification> = z.strictObject({
  moments: uniqueList(LITURGICAL_MOMENT_IDS, 11),
  seasons: uniqueList(LITURGICAL_SEASON_IDS, 6),
  celebrations: uniqueList(LITURGICAL_CELEBRATION_IDS, 20),
  themes: uniqueList(BIBLICAL_THEME_IDS, 20),
});

const optionalText = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`).optional();

const submissionFields = {
  /** Gerado no navegador: repetir o mesmo pedido não cria outra proposta. */
  requestId: z.uuid({ error: "Identificador de pedido inválido." }),
  suggestedClassification: suggestedClassificationSchema.default(EMPTY_SUGGESTED_CLASSIFICATION),
  video: z
    .strictObject({
      url: z.string().trim().max(500),
      title: optionalText(200),
      kind: z.enum(VIDEO_KINDS).default("reference"),
      ownPerformance: z.boolean().default(false),
    })
    .nullable()
    .default(null),
  rights: z.strictObject({
    status: z.enum(RIGHTS_STATUSES, { error: "Informe a situação dos direitos." }),
    license: z.strictObject({ display: z.boolean(), reproduce: z.boolean(), redistribute: z.boolean() }).default(NO_LICENSE),
    accepted: z.literal(true, { error: "Confirme a declaração antes de enviar." }),
    note: optionalText(SUBMISSION_TEXT_MAX),
  }),
  credit: z.strictObject({ show: z.boolean(), name: z.string().max(200).optional() }),
  /** Obrigatória quando o catálogo já tem músicas parecidas. */
  duplicateJustification: optionalText(SUBMISSION_TEXT_MAX),
  message: optionalText(SUBMISSION_TEXT_MAX),
};

type SubmissionFields = z.output<z.ZodObject<typeof submissionFields>>;

function refineSubmission(value: SubmissionFields, context: z.RefinementCtx): void {
  if (value.video && !parseYouTubeId(value.video.url)) {
    context.addIssue({ code: "custom", path: ["video", "url"], message: "Informe um link válido de vídeo do YouTube." });
  }
  if (value.credit.show) {
    const problem = publicNameProblem(value.credit.name ?? "");
    if (problem) context.addIssue({ code: "custom", path: ["credit", "name"], message: problem });
  }
  const { license, status } = value.rights;
  if (!canLicenseContent(status) && (license.display || license.reproduce || license.redistribute)) {
    context.addIssue({
      code: "custom",
      path: ["rights", "license"],
      message: "Só quem compôs ou tem autorização pode autorizar a publicação da letra e da cifra.",
    });
  }
  if (license.redistribute && !license.display) {
    context.addIssue({ code: "custom", path: ["rights", "license"], message: "Redistribuir exige também autorizar a exibição." });
  }
  if (license.display && !license.reproduce) {
    context.addIssue({ code: "custom", path: ["rights", "license"], message: "Exibir a cifra no catálogo exige também autorizar a reprodução." });
  }
}

/**
 * O que o colaborador envia. A música vem da biblioteca da própria conta pelo identificador:
 * o conteúdo não é digitado de novo nem aceito do navegador.
 */
export const submissionRequestSchema = z
  .strictObject({ songId: entityIdSchema, ...submissionFields })
  .superRefine(refineSubmission);

/** Reenvio após pedido de correções: a música é a mesma da proposta; o conteúdo é relido da biblioteca. */
export const resubmissionRequestSchema = z.strictObject(submissionFields).superRefine(refineSubmission);

export type SubmissionRequest = z.input<typeof submissionRequestSchema>;
export type ValidSubmissionRequest = z.output<typeof submissionRequestSchema>;
export type ResubmissionRequest = z.input<typeof resubmissionRequestSchema>;
export type ValidResubmissionRequest = z.output<typeof resubmissionRequestSchema>;

/** Converte o vídeo informado em referência estruturada (o link original não é guardado). */
export function toSubmissionVideo(video: ValidSubmissionRequest["video"]): SubmissionVideo | null {
  const videoId = video ? parseYouTubeId(video.url) : null;
  if (!video || !videoId) {
    return null;
  }
  return {
    provider: "youtube",
    videoId,
    ...(video.title ? { title: video.title } : {}),
    kind: video.ownPerformance ? "performance" : video.kind,
    ownPerformance: video.ownPerformance,
  };
}

// ---------------------------------------------------------------------------------------------
// Possíveis duplicatas

export interface DuplicateCandidate {
  id: string;
  title: string;
  artist: string;
  status: string;
}

export type DuplicateMatch = DuplicateCandidate & {
  /** `same-song`: mesmo título e autoria compatível. `same-title`: título igual, autoria diferente. */
  kind: "same-song" | "same-title";
};

/** Título comparável: sem acentos, caixa, pontuação nem espaços repetidos. */
export function comparableTitle(title: string): string {
  return tokenize(title).join(" ");
}

/**
 * Classifica candidatas pelo título e pela autoria. Título igual não basta para dizer que é a
 * mesma música: com autorias diferentes, a candidata aparece só como "mesmo título". Nada é
 * mesclado automaticamente.
 */
export function findDuplicateMatches(
  snapshot: Pick<SubmissionSnapshot, "title" | "artist">,
  candidates: readonly DuplicateCandidate[],
): DuplicateMatch[] {
  const title = comparableTitle(snapshot.title);
  const artist = comparableTitle(snapshot.artist);
  return candidates.flatMap((candidate): DuplicateMatch[] => {
    if (!title || comparableTitle(candidate.title) !== title) {
      return [];
    }
    const otherArtist = comparableTitle(candidate.artist);
    const compatible = !artist || !otherArtist || artist === otherArtist;
    return [{ ...candidate, kind: compatible ? "same-song" : "same-title" }];
  });
}

// ---------------------------------------------------------------------------------------------
// Visões

export interface SubmissionHistoryEntry {
  action: "submitted" | SubmissionAction;
  /** Quem agiu, sem identificar administradores para o colaborador. */
  actor: "author" | "admin";
  at: IsoDateTime;
  version: number;
  note?: string;
}

export interface SubmissionVersion {
  version: number;
  snapshot: SubmissionSnapshot;
  sourceSongRevision: Revision;
  submittedAt: IsoDateTime;
}

/** O que o colaborador vê da própria proposta: nunca dados de outras contas nem da administração. */
export interface MySubmission {
  id: string;
  personalSongId: string;
  sourceSongRevision: Revision;
  version: number;
  snapshot: SubmissionSnapshot;
  suggestedClassification: SuggestedClassification;
  video: SubmissionVideo | null;
  rights: RightsDeclaration;
  credit: PublicCreditPreference;
  duplicateJustification?: string;
  message?: string;
  status: SubmissionStatus;
  /** Justificativa da decisão, quando houver. */
  reviewNote?: string;
  /** Música oficial resultante, quando publicada. */
  resultingCatalogSong?: { id: string; title: string; published: boolean };
  history: SubmissionHistoryEntry[];
  previousVersions: SubmissionVersion[];
  revision: Revision;
  createdAt: IsoDateTime;
  submittedAt: IsoDateTime;
  reviewedAt: IsoDateTime | null;
  updatedAt: IsoDateTime;
}

/** Visão da administração: a mesma proposta, com remetente e possíveis duplicatas atuais. */
export type AdminSubmission = Omit<MySubmission, "resultingCatalogSong"> & {
  submittedBy: { id: string; name: string; email: string } | null;
  duplicates: DuplicateMatch[];
  resultingCatalogSongId: string | null;
  review: { by: string; at: IsoDateTime; decision: SubmissionAction; mode?: ApprovalMode; note?: string } | null;
};

/** Linha de "Minhas sugestões". */
export interface SubmissionSummary {
  id: string;
  personalSongId: string;
  title: string;
  artist: string;
  status: SubmissionStatus;
  version: number;
  reviewNote?: string;
  resultingCatalogSong?: { id: string; title: string; published: boolean };
  revision: Revision;
  submittedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Linha da fila da administração: o nome da conta é lido na hora, nunca copiado na proposta. */
export interface AdminSubmissionSummary {
  id: string;
  title: string;
  artist: string;
  status: SubmissionStatus;
  version: number;
  submitterName: string | null;
  hasContent: boolean;
  hasVideo: boolean;
  rightsStatus: RightsStatus;
  submittedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Prévia do envio: o que será enviado, possíveis duplicatas e se já há proposta ativa. */
export interface SubmissionPreview {
  snapshot: SubmissionSnapshot;
  sourceSongRevision: Revision;
  duplicates: DuplicateMatch[];
  activeSubmission: { id: string; status: SubmissionStatus } | null;
  limits: { maxPending: number; pending: number; maxPerDay: number; today: number; maxChordProLength: number };
}

// ---------------------------------------------------------------------------------------------
// Decisões da administração

export const APPROVAL_MODES = ["new", "complement"] as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[number];

/** Versão editorial: o que a administração ajusta antes de publicar, sem tocar na biblioteca do colaborador. */
const editorialSchema = z.strictObject({
  title: z.string().trim().min(1, "Informe o título.").max(300),
  artist: z.string().trim().max(300),
  originalKey: z.enum(MUSICAL_KEYS).optional(),
  compositionReference: z.string().trim().max(300).optional(),
});

const reviewNote = z.string().trim().max(SUBMISSION_TEXT_MAX);

export const approvalRequestSchema = z.discriminatedUnion("mode", [
  z.strictObject({
    mode: z.literal("new"),
    requestId: z.uuid(),
    editorial: editorialSchema,
    /** B: autorizar a publicação da letra e da cifra. Sem isso, entram só os metadados. */
    publishContent: z.boolean(),
    /** Redistribuir em links públicos; só com publicação do conteúdo e licença para isso. */
    shareContent: z.boolean().default(false),
    /** Publicar agora ou deixar como rascunho para mais edição em /admin/catalogo. */
    publish: z.boolean(),
    includeClassification: z.boolean(),
    includeVideo: z.boolean(),
    /** A administração conferiu que o vídeo corresponde à música. */
    videoVerified: z.boolean().default(false),
    /** Nome público moderado; `null` não exibe crédito. */
    creditName: z.string().max(200).nullable(),
    /** Duplicatas vistas na análise. Uma nova, surgida depois, interrompe a aprovação. */
    knownDuplicateIds: z.array(entityIdSchema).max(100).default([]),
    duplicatesChecked: z.literal(true, { error: "Confira as possíveis duplicatas antes de aprovar." }),
    rightsChecked: z.literal(true, { error: "Confira os direitos antes de aprovar." }),
    note: reviewNote.optional(),
  }),
  z.strictObject({
    mode: z.literal("complement"),
    requestId: z.uuid(),
    targetCatalogSongId: entityIdSchema,
    targetRevision: revisionSchema,
    includeClassification: z.boolean(),
    includeVideo: z.boolean(),
    videoVerified: z.boolean().default(false),
    /** Completa o tom só se o destino não o tem: título, autoria e cifra oficiais nunca são substituídos. */
    fillOriginalKey: z.boolean().default(false),
    duplicatesChecked: z.literal(true, { error: "Confira as possíveis duplicatas antes de aprovar." }),
    note: reviewNote.optional(),
  }),
]);

export type ApprovalRequest = z.input<typeof approvalRequestSchema>;

export const decisionNoteSchema = z.strictObject({
  note: reviewNote.min(1, "Registre a justificativa."),
});
