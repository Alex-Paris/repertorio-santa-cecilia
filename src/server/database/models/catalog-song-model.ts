import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

import { CATALOG_STATUSES, RIGHTS_BASES, type CatalogStatus, type RightsBasis } from "@/features/catalog/domain/catalog-song";
import { BIBLE_BOOK_IDS, type BibleBookId } from "@/features/liturgy/domain/scripture";
import {
  BIBLICAL_THEME_IDS,
  LITURGICAL_CELEBRATION_IDS,
  LITURGICAL_MOMENT_IDS,
  LITURGICAL_SEASON_IDS,
  SONG_USE_CATEGORY_IDS,
  type BiblicalThemeId,
  type LiturgicalCelebrationId,
  type LiturgicalMomentId,
  type LiturgicalSeasonId,
  type SongUseCategory,
} from "@/features/liturgy/domain/vocabulary";
import { MUSICAL_KEYS, type MusicalKey } from "@/features/songs/domain/musical-key";
import { CATALOG_CONTENT_TYPES, type CatalogContentType } from "@/features/songs/domain/song";
import { CLASSIFICATION_REVIEW_STATUSES, type ClassificationReviewStatus } from "@/features/liturgy/domain/classification";
import { MAX_VIDEO_START_SECONDS } from "@/features/songs/domain/video-reference";

export interface CatalogRightsDocument {
  basis: RightsBasis;
  evidence: string;
  displayChordPro: boolean;
  shareChordPro: boolean;
  /** Ausente nas músicas anteriores à Etapa 2E.4: vale como permitido. */
  linkExternalSource?: boolean;
  approvedBy: string;
  approvedAt: Date;
}

export interface ScriptureReferenceDocument {
  book: BibleBookId;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

/** Classificação litúrgica. Uma música pode ter vários valores em cada dimensão. */
export interface CatalogLiturgyDocument {
  category: SongUseCategory;
  moments: LiturgicalMomentId[];
  seasons: LiturgicalSeasonId[];
  celebrations: LiturgicalCelebrationId[];
  themes: BiblicalThemeId[];
  scripture: ScriptureReferenceDocument[];
  avoidSeasons: LiturgicalSeasonId[];
  suitabilityNotes: string;
  editorialRationale: string;
  /** Ausente nas classificações anteriores à Etapa 2E.4: vale como texto vazio. */
  guidanceSource?: string;
  officialReference: string;
  classifiedBy: string;
  classifiedAt: Date;
  /** Ausente nas classificações anteriores à Etapa 2E.4: valem como não conferidas. */
  reviewStatus?: ClassificationReviewStatus;
  review?: { by: string; at: Date; source: string } | null;
  dispute?: { note: string; by: string; at: Date } | null;
}

export interface CatalogMetadataSourceDocument {
  title: string;
  url?: string;
  accessedAt?: string;
}

/** Vídeo de referência aprovado (Etapa 2F.1): só provedor e identificador, nunca HTML. */
export interface CatalogVideoDocument {
  provider: "youtube";
  videoId: string;
  title?: string;
  startSeconds?: number;
  kind: "performance" | "reference";
  submissionId?: string;
  approvedBy: string;
  approvedAt: Date;
}

/** Contribuição aceita (Etapa 2F.1): de qual proposta e versão, o que foi aplicado e o que foi autorizado. */
export interface CatalogContributionDocument {
  submissionId: string;
  submissionVersion: number;
  mode: "new" | "complement";
  fields: string[];
  approvedBy: string;
  approvedAt: Date;
  publicCredit?: string;
  license?: {
    display: boolean;
    reproduce: boolean;
    redistribute: boolean;
    declarationVersion: string;
    acceptedAt: Date;
  };
}

/** Música global. Não tem dono: não há `ownerId`, e o acesso segue regras próprias. */
export interface CatalogSongDocument {
  id: string;
  title: string;
  artist: string;
  /** Pode faltar em música só com metadados, quando a fonte não informa o tom. */
  originalKey?: MusicalKey;
  contentType: CatalogContentType;
  chordPro?: string;
  sourceUrl?: string;
  /** Chave estável da importação editorial; única quando existe. */
  importKey?: string;
  compositionReference?: string;
  /** Ausente nas músicas anteriores à Etapa 2E.4: vale como lista vazia. */
  metadataSources?: CatalogMetadataSourceDocument[];
  status: CatalogStatus;
  rights: CatalogRightsDocument;
  revision: number;
  /** Campos derivados para busca e ordenação; nunca saem em respostas. */
  searchTokens: string[];
  sortTitle: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  /** Ausente em músicas ainda não classificadas, inclusive todas as anteriores à Etapa 2E.2. */
  liturgy?: CatalogLiturgyDocument;
  video?: CatalogVideoDocument;
  /** Ausente nas músicas cadastradas só pela administração. */
  contributions?: CatalogContributionDocument[];
}

// Subdocumentos com `versionKey: false`: ao repetir uma transação (aprovação de contribuição),
// o Mongoose restaura a chave de versão dos documentos criados, e o modo estrito recusaria `__v`.
const rightsSchema = new Schema<CatalogRightsDocument>(
  {
    basis: { type: String, enum: RIGHTS_BASES, required: true },
    // Rascunhos podem ter a evidência pendente; a publicação a exige.
    evidence: { type: String, default: "" },
    displayChordPro: { type: Boolean, required: true },
    shareChordPro: { type: Boolean, required: true },
    // Ausente nas músicas anteriores à Etapa 2E.4: o link externo continua visível.
    linkExternalSource: { type: Boolean },
    approvedBy: { type: String, required: true },
    approvedAt: { type: Date, required: true },
  },
  { _id: false, id: false, versionKey: false, strict: "throw" },
);

const scriptureSchema = new Schema<ScriptureReferenceDocument>(
  {
    book: { type: String, enum: BIBLE_BOOK_IDS, required: true },
    chapter: { type: Number, required: true },
    verseStart: { type: Number },
    verseEnd: { type: Number },
  },
  { _id: false, id: false, versionKey: false, strict: "throw" },
);

const liturgySchema = new Schema<CatalogLiturgyDocument>(
  {
    category: { type: String, enum: SONG_USE_CATEGORY_IDS, required: true },
    moments: { type: [{ type: String, enum: LITURGICAL_MOMENT_IDS }], default: [] },
    seasons: { type: [{ type: String, enum: LITURGICAL_SEASON_IDS }], default: [] },
    celebrations: { type: [{ type: String, enum: LITURGICAL_CELEBRATION_IDS }], default: [] },
    themes: { type: [{ type: String, enum: BIBLICAL_THEME_IDS }], default: [] },
    scripture: { type: [scriptureSchema], default: [] },
    avoidSeasons: { type: [{ type: String, enum: LITURGICAL_SEASON_IDS }], default: [] },
    // Texto vazio é válido; `required` do Mongoose o rejeitaria.
    suitabilityNotes: { type: String, default: "" },
    editorialRationale: { type: String, default: "" },
    guidanceSource: { type: String, default: "" },
    officialReference: { type: String, default: "" },
    classifiedBy: { type: String, required: true },
    classifiedAt: { type: Date, required: true },
    reviewStatus: { type: String, enum: CLASSIFICATION_REVIEW_STATUSES, default: "pending_review" },
    review: {
      type: new Schema({ by: { type: String, required: true }, at: { type: Date, required: true }, source: { type: String, required: true } }, { _id: false, id: false, versionKey: false, strict: "throw" }),
      default: null,
    },
    dispute: {
      type: new Schema({ note: { type: String, required: true }, by: { type: String, required: true }, at: { type: Date, required: true } }, { _id: false, id: false, versionKey: false, strict: "throw" }),
      default: null,
    },
  },
  { _id: false, id: false, versionKey: false, strict: "throw" },
);

const catalogSongSchema = new Schema<CatalogSongDocument>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    // Vazio quando a fonte não confirma a autoria (só em músicas com metadados).
    artist: { type: String, default: "" },
    originalKey: { type: String, enum: MUSICAL_KEYS },
    contentType: { type: String, required: true, enum: CATALOG_CONTENT_TYPES },
    chordPro: { type: String },
    sourceUrl: { type: String },
    importKey: { type: String },
    compositionReference: { type: String },
    metadataSources: {
      type: [
        new Schema(
          { title: { type: String, required: true }, url: { type: String }, accessedAt: { type: String } },
          { _id: false, id: false, versionKey: false, strict: "throw" },
        ),
      ],
      default: undefined,
    },
    status: { type: String, required: true, enum: CATALOG_STATUSES },
    rights: { type: rightsSchema, required: true },
    revision: { type: Number, required: true },
    searchTokens: { type: [String], default: [] },
    sortTitle: { type: String, required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    publishedAt: { type: Date },
    liturgy: { type: liturgySchema },
    video: {
      type: new Schema<CatalogVideoDocument>(
        {
          provider: { type: String, required: true, enum: ["youtube"] },
          videoId: { type: String, required: true, match: /^[A-Za-z0-9_-]{11}$/ },
          startSeconds: { type: Number, min: 0, max: MAX_VIDEO_START_SECONDS, validate: Number.isInteger },
          title: { type: String },
          kind: { type: String, required: true, enum: ["performance", "reference"] },
          submissionId: { type: String },
          approvedBy: { type: String, required: true },
          approvedAt: { type: Date, required: true },
        },
        { _id: false, id: false, versionKey: false, strict: "throw" },
      ),
    },
    contributions: {
      type: [
        new Schema<CatalogContributionDocument>(
          {
            submissionId: { type: String, required: true },
            submissionVersion: { type: Number, required: true },
            mode: { type: String, required: true, enum: ["new", "complement"] },
            fields: { type: [String], default: [] },
            approvedBy: { type: String, required: true },
            approvedAt: { type: Date, required: true },
            publicCredit: { type: String },
            license: {
              type: new Schema(
                {
                  display: { type: Boolean, required: true },
                  reproduce: { type: Boolean, required: true },
                  redistribute: { type: Boolean, required: true },
                  declarationVersion: { type: String, required: true },
                  acceptedAt: { type: Date, required: true },
                },
                { _id: false, id: false, versionKey: false, strict: "throw" },
              ),
            },
          },
          { _id: false, id: false, versionKey: false, strict: "throw" },
        ),
      ],
      default: undefined,
    },
  },
  {
    id: false,
    versionKey: false,
    strict: "throw",
    collection: "catalog_songs",
    autoIndex: false,
    autoCreate: false,
  },
);

catalogSongSchema.index({ id: 1 }, { unique: true });
// Importação editorial idempotente: a mesma chave nunca cria duas músicas.
catalogSongSchema.index({ importKey: 1 }, { unique: true, partialFilterExpression: { importKey: { $type: "string" } } });
// Listagem pública: só publicadas, em ordem de título, com desempate pelo ID.
catalogSongSchema.index({ status: 1, sortTitle: 1, id: 1 });
// Busca por prefixo de palavra, também restrita a publicadas.
catalogSongSchema.index({ status: 1, searchTokens: 1 });
// Exploração litúrgica. Um índice por dimensão: o MongoDB não combina dois campos de lista
// no mesmo índice. Filtros combinados usam um deles e conferem os demais nos documentos.
catalogSongSchema.index({ status: 1, "liturgy.moments": 1, sortTitle: 1, id: 1 });
catalogSongSchema.index({ status: 1, "liturgy.seasons": 1, sortTitle: 1, id: 1 });
catalogSongSchema.index({ status: 1, "liturgy.celebrations": 1, sortTitle: 1, id: 1 });
catalogSongSchema.index({ status: 1, "liturgy.themes": 1, sortTitle: 1, id: 1 });

export const CatalogSongModel: Model<CatalogSongDocument> =
  (mongoose.models.CatalogSong as Model<CatalogSongDocument> | undefined) ??
  mongoose.model<CatalogSongDocument>("CatalogSong", catalogSongSchema);
