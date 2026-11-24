import { z } from "zod";

import type { CatalogSongView } from "@/features/library/domain/library";
import {
  publicSongClassificationSchema,
  songClassificationSchema,
  toPublicClassification,
  type SongClassification,
} from "@/features/liturgy/domain/classification";
import {
  BIBLICAL_THEME_IDS,
  LITURGICAL_CELEBRATION_IDS,
  LITURGICAL_MOMENT_IDS,
  LITURGICAL_SEASON_IDS,
  type LiturgicalMomentId,
  type LiturgicalSeasonId,
} from "@/features/liturgy/domain/vocabulary";
import { MUSICAL_KEYS } from "@/features/songs/domain/musical-key";
import type { CatalogSongInputData, IsoDateTime, MusicalSong, Revision } from "@/features/songs/domain/song";
import { catalogSongDataSchema, entityIdSchema, revisionSchema } from "@/features/songs/domain/song-schema";
import { isValidIsoDate } from "@/features/liturgy/domain/calendar";
import { isSafeExternalUrl } from "@/lib/utils/is-safe-external-url";
import { catalogVideoInputSchema, publicVideoReferenceSchema as publicVideoSchema, videoStartSecondsSchema, type CatalogVideoInput } from "./catalog-video";

export const CATALOG_STATUSES = ["draft", "published", "unpublished"] as const;
export type CatalogStatus = (typeof CATALOG_STATUSES)[number];

/** Fundamento que permite à plataforma exibir a música. */
export const RIGHTS_BASES = [
  "original-work",
  "license",
  "author-permission",
  "public-domain",
  "external-reference",
  "public-metadata",
] as const;
export type RightsBasis = (typeof RIGHTS_BASES)[number];

export const RIGHTS_BASIS_LABELS: Record<RightsBasis, string> = {
  "original-work": "Obra original da plataforma",
  license: "Licença",
  "author-permission": "Autorização do autor ou titular",
  "public-domain": "Domínio público",
  "external-reference": "Apenas referência externa",
  "public-metadata": "Somente metadados de fonte pública (sem letra nem cifra)",
};

/**
 * Direitos verificados por um administrador. O tipo de conteúdo da música ("Autorizada")
 * nunca basta: só estes campos permitem exibir ou redistribuir a cifra.
 */
export interface CatalogRights {
  basis: RightsBasis;
  /** Evidência disponível para a administração. Nunca sai em respostas públicas. */
  evidence: string;
  /** A cifra pode ser exibida no catálogo. */
  displayChordPro: boolean;
  /** A cifra pode entrar em links públicos de repertórios. */
  shareChordPro: boolean;
  /**
   * O link para a cifra externa pode ser mostrado. Exibir metadados (título, autoria) depende
   * só da publicação; nenhuma destas permissões vem da classificação litúrgica.
   */
  linkExternalSource: boolean;
  /** Conta administrativa que aprovou estes direitos, e quando. */
  approvedBy: string;
  approvedAt: IsoDateTime;
}

/** Onde os metadados da música foram consultados. Público. */
export interface CatalogMetadataSource {
  title: string;
  url?: string;
  /** Data da consulta, `AAAA-MM-DD`. */
  accessedAt?: string;
}

/** Vídeo de referência aprovado pela administração (Etapa 2F.1). */
export interface CatalogVideo {
  provider: "youtube";
  videoId: string;
  title?: string;
  startSeconds?: number;
  kind: "performance" | "reference";
  /** Proposta de onde veio, quando veio de uma contribuição. */
  submissionId?: string;
  approvedBy: string;
  approvedAt: IsoDateTime;
}

/**
 * Contribuição aceita para esta música: de qual proposta, em qual versão, o que foi aplicado
 * e o que o colaborador autorizou. A autorização é uma declaração, conferida pela administração.
 */
export interface CatalogContribution {
  submissionId: string;
  submissionVersion: number;
  mode: "new" | "complement";
  /** Campos aplicados a partir da proposta. */
  fields: string[];
  approvedBy: string;
  approvedAt: IsoDateTime;
  /** Nome público autorizado, já moderado. Ausente: sem crédito. */
  publicCredit?: string;
  /** Licença não exclusiva declarada, quando a letra e a cifra vieram da proposta. */
  license?: {
    display: boolean;
    reproduce: boolean;
    redistribute: boolean;
    declarationVersion: string;
    acceptedAt: IsoDateTime;
  };
}

/** Identificação editorial que vai além dos dados musicais. */
export interface CatalogSongDetails {
  /** Referência da composição: hinário, coletânea, ano, número. */
  compositionReference?: string;
  /** Fontes consultadas para título e autoria. */
  metadataSources: CatalogMetadataSource[];
  video?: CatalogVideo;
  /** Contribuições aceitas, em ordem. Vazio nas músicas cadastradas só pela administração. */
  contributions?: CatalogContribution[];
}

/** Música do catálogo central, como a administração a vê. */
export type CatalogSong = MusicalSong & CatalogSongDetails & {
  /** Chave estável da importação editorial, para importar de novo sem duplicar. */
  importKey?: string;
  status: CatalogStatus;
  rights: CatalogRights;
  revision: Revision;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /** Primeira publicação. Depois dela, o tom original não pode mais mudar. */
  publishedAt: IsoDateTime | null;
  /** Classificação litúrgica. `null` enquanto a administração não classificar a música. */
  liturgy: SongClassification | null;
};

export interface CatalogSongSummary {
  id: string;
  title: string;
  artist: string;
  originalKey?: MusicalSong["originalKey"];
  contentType: MusicalSong["contentType"];
  /** Há cifra que pode ser exibida no catálogo. */
  hasChordPro: boolean;
  video?: CatalogSongView["video"];
  /** Momentos e tempos da classificação litúrgica; vazios sem classificação. */
  moments?: LiturgicalMomentId[];
  seasons?: LiturgicalSeasonId[];
}

export interface CatalogSearchResult {
  songs: CatalogSongSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type { CatalogSongView };

export const CATALOG_PAGE_SIZE = 12;
export const MAX_CATALOG_PAGE_SIZE = 24;
export const MAX_CATALOG_PAGE = 50;
export const MAX_CATALOG_QUERY_LENGTH = 100;

/** Parâmetros públicos de busca: texto, filtros litúrgicos, página e tamanho, todos limitados. */
export const catalogSearchSchema = z.strictObject({
  q: z.string().max(MAX_CATALOG_QUERY_LENGTH).optional().default(""),
  moment: z.enum(LITURGICAL_MOMENT_IDS).optional(),
  season: z.enum(LITURGICAL_SEASON_IDS).optional(),
  celebration: z.enum(LITURGICAL_CELEBRATION_IDS).optional(),
  theme: z.enum(BIBLICAL_THEME_IDS).optional(),
  page: z.coerce.number().int().min(1).max(MAX_CATALOG_PAGE).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_CATALOG_PAGE_SIZE).optional().default(CATALOG_PAGE_SIZE),
});

export type CatalogSearchParams = z.infer<typeof catalogSearchSchema>;

export type CatalogFilters = Pick<CatalogSearchParams, "moment" | "season" | "celebration" | "theme">;

/**
 * Direitos informados. Em rascunho, a evidência pode ficar pendente; a publicação a exige
 * (veja `publicationProblems`).
 */
export const catalogRightsInputSchema = z
  .strictObject({
    basis: z.enum(RIGHTS_BASES, { error: "Escolha o fundamento dos direitos." }),
    evidence: z
      .string({ error: "Descreva a evidência disponível." })
      .trim()
      .max(2000, "A evidência deve ter no máximo 2000 caracteres."),
    displayChordPro: z.boolean(),
    shareChordPro: z.boolean(),
    linkExternalSource: z.boolean().optional().default(true),
  })
  .refine((rights) => rights.displayChordPro || !rights.shareChordPro, {
    message: "Só é possível redistribuir uma cifra que também pode ser exibida.",
    path: ["shareChordPro"],
  });

export type CatalogRightsInput = z.infer<typeof catalogRightsInputSchema>;

export const MAX_METADATA_SOURCES = 10;

export const catalogMetadataSourceSchema: z.ZodType<CatalogMetadataSource> = z.strictObject({
  title: z.string().trim().min(1, "Informe o título da fonte consultada.").max(300),
  url: z.string().trim().max(2048).refine(isSafeExternalUrl, "Use um endereço http(s).").optional(),
  accessedAt: z.string().refine(isValidIsoDate, "Informe a data da consulta (AAAA-MM-DD).").optional(),
});

const detailsFields = {
  compositionReference: z.string().trim().min(1).max(300, "A referência deve ter no máximo 300 caracteres.").optional(),
  metadataSources: z.array(catalogMetadataSourceSchema).max(MAX_METADATA_SOURCES).optional().default([]),
};

/** Dados musicais (inclusive só metadados), direitos e identificação editorial. */
export const catalogSongInputSchema = z.strictObject({
  song: catalogSongDataSchema,
  rights: catalogRightsInputSchema,
  video: catalogVideoInputSchema.nullable().optional(),
  ...detailsFields,
});

export type CatalogSongInput = {
  song: CatalogSongInputData;
  rights: z.input<typeof catalogRightsInputSchema>;
  compositionReference?: string;
  metadataSources?: CatalogMetadataSource[];
  /** Ausente: preserva o vídeo existente. `null`: remove a referência. */
  video?: CatalogVideoInput | null;
};

const musicalFields = {
  id: entityIdSchema,
  title: z.string().min(1).max(300),
  artist: z.string().max(300),
  originalKey: z.enum(MUSICAL_KEYS),
};

const publicDetails = {
  compositionReference: z.string().max(300).optional(),
  metadataSources: z.array(catalogMetadataSourceSchema).optional(),
  video: publicVideoSchema.optional(),
  contributorCredit: z.string().max(60).optional(),
};

const catalogVideoSchema = z.strictObject({
  provider: z.literal("youtube"),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: z.string().optional(),
  startSeconds: videoStartSecondsSchema.optional(),
  kind: z.enum(["performance", "reference"]),
  submissionId: z.string().optional(),
  approvedBy: z.string(),
  approvedAt: z.iso.datetime(),
});

const catalogContributionSchema = z.strictObject({
  submissionId: z.string(),
  submissionVersion: z.number().int().positive(),
  mode: z.enum(["new", "complement"]),
  fields: z.array(z.string()),
  approvedBy: z.string(),
  approvedAt: z.iso.datetime(),
  publicCredit: z.string().optional(),
  license: z
    .strictObject({
      display: z.boolean(),
      reproduce: z.boolean(),
      redistribute: z.boolean(),
      declarationVersion: z.string(),
      acceptedAt: z.iso.datetime(),
    })
    .optional(),
});

const hostedView = z.strictObject({
  ...musicalFields,
  contentType: z.enum(["original", "authorized"]),
  chordPro: z.string().max(100_000).optional(),
  chordProAvailable: z.boolean(),
  liturgy: publicSongClassificationSchema.optional(),
  ...publicDetails,
});

const externalView = z.strictObject({
  ...musicalFields,
  contentType: z.literal("external-link"),
  sourceUrl: z.string().max(2048).refine(isSafeExternalUrl),
  chordProAvailable: z.literal(false),
  liturgy: publicSongClassificationSchema.optional(),
  ...publicDetails,
});

const metadataView = z.strictObject({
  ...musicalFields,
  originalKey: z.enum(MUSICAL_KEYS).optional(),
  contentType: z.literal("metadata-only"),
  chordProAvailable: z.literal(false),
  liturgy: publicSongClassificationSchema.optional(),
  ...publicDetails,
});

/** Música do catálogo entregue a qualquer pessoa: nada de direitos, evidências ou revisão. */
export const catalogSongViewSchema: z.ZodType<CatalogSongView> = z.discriminatedUnion("contentType", [
  hostedView,
  externalView,
  metadataView,
]) as z.ZodType<CatalogSongView>;

export const catalogSongSummarySchema: z.ZodType<CatalogSongSummary> = z.strictObject({
  ...musicalFields,
  originalKey: z.enum(MUSICAL_KEYS).optional(),
  contentType: z.enum(["original", "authorized", "external-link", "metadata-only"]),
  hasChordPro: z.boolean(),
  video: publicVideoSchema.optional(),
  moments: z.array(z.enum(LITURGICAL_MOMENT_IDS)).optional(),
  seasons: z.array(z.enum(LITURGICAL_SEASON_IDS)).optional(),
});

export const catalogSearchResultSchema: z.ZodType<CatalogSearchResult> = z.strictObject({
  songs: z.array(catalogSongSummarySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const catalogSongSchema: z.ZodType<CatalogSong> = z.intersection(
  catalogSongDataSchema,
  z.object({
    id: entityIdSchema,
    importKey: z.string().optional(),
    compositionReference: z.string().optional(),
    metadataSources: z.array(catalogMetadataSourceSchema),
    video: catalogVideoSchema.optional(),
    contributions: z.array(catalogContributionSchema).optional(),
    status: z.enum(CATALOG_STATUSES),
    rights: z.strictObject({
      basis: z.enum(RIGHTS_BASES),
      evidence: z.string(),
      displayChordPro: z.boolean(),
      shareChordPro: z.boolean(),
      linkExternalSource: z.boolean(),
      approvedBy: z.string(),
      approvedAt: z.iso.datetime(),
    }),
    revision: revisionSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    publishedAt: z.iso.datetime().nullable(),
    liturgy: songClassificationSchema.nullable(),
  }),
) as z.ZodType<CatalogSong>;

/** O mínimo para decidir permissões, com direitos vindos do domínio ou do banco. */
interface PermissionFields {
  status: CatalogStatus;
  contentType: CatalogSong["contentType"];
  rights: Pick<CatalogRights, "displayChordPro" | "shareChordPro">;
}

/** A cifra pode aparecer no catálogo agora? Só existe cifra em músicas próprias ou autorizadas. */
export function canDisplayChordPro(song: PermissionFields): boolean {
  return (
    song.status === "published" &&
    (song.contentType === "original" || song.contentType === "authorized") &&
    song.rights.displayChordPro
  );
}

/** O que impede a publicação. Rascunhos podem ficar incompletos; a publicação, não. */
export function publicationProblems(song: Pick<CatalogSong, "title" | "contentType" | "rights">): string[] {
  const problems: string[] = [];
  if (!song.title.trim()) {
    problems.push("Informe o título.");
  }
  if (!song.rights.evidence.trim()) {
    problems.push("Registre a evidência dos direitos antes de publicar.");
  }
  return problems;
}

/** A cifra pode entrar em um link público de repertório agora? */
export function canShareChordPro(song: PermissionFields): boolean {
  return canDisplayChordPro(song) && song.rights.shareChordPro;
}

/** Crédito público: o da contribuição que criou a música, se o colaborador o autorizou. */
export function contributorCredit(song: Pick<CatalogSong, "contributions">): string | undefined {
  return song.contributions?.find((entry) => entry.mode === "new" && entry.publicCredit)?.publicCredit;
}

/**
 * Projeção para usuários comuns. A cifra só aparece quando a exibição é permitida, e o link
 * externo só quando mostrá-lo é permitido; sem isso, a música aparece só com metadados.
 */
export function toCatalogSongView(song: CatalogSong): CatalogSongView {
  const common = {
    id: song.id,
    title: song.title,
    artist: song.artist,
    // A justificativa editorial e quem classificou ficam na administração.
    ...(song.liturgy ? { liturgy: toPublicClassification(song.liturgy) } : {}),
    ...(song.compositionReference ? { compositionReference: song.compositionReference } : {}),
    ...(song.metadataSources.length > 0 ? { metadataSources: song.metadataSources.map((source) => ({ ...source })) } : {}),
    // Só a referência pública e o início; aprovação e proposta de origem ficam na administração.
    ...(song.video
      ? { video: { provider: song.video.provider, videoId: song.video.videoId, ...(song.video.title ? { title: song.video.title } : {}), ...(song.video.startSeconds ? { startSeconds: song.video.startSeconds } : {}) } }
      : {}),
    ...(contributorCredit(song) ? { contributorCredit: contributorCredit(song) } : {}),
  };

  if (song.contentType === "metadata-only" || (song.contentType === "external-link" && !song.rights.linkExternalSource)) {
    return {
      ...common,
      ...(song.originalKey ? { originalKey: song.originalKey } : {}),
      contentType: "metadata-only",
      chordProAvailable: false,
    };
  }

  const base = { ...common, originalKey: song.originalKey };
  if (song.contentType === "external-link") {
    return { ...base, contentType: "external-link", sourceUrl: song.sourceUrl, chordProAvailable: false };
  }

  const available = canDisplayChordPro(song) && Boolean(song.chordPro?.trim());
  return {
    ...base,
    contentType: song.contentType,
    ...(available ? { chordPro: song.chordPro } : {}),
    chordProAvailable: available,
  };
}
