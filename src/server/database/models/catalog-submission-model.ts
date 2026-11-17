import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

import {
  APPROVAL_MODES,
  RIGHTS_STATUSES,
  SUBMISSION_STATUSES,
  VIDEO_KINDS,
  type ApprovalMode,
  type RightsStatus,
  type SubmissionAction,
  type SubmissionStatus,
  type VideoKind,
} from "@/features/contributions/domain/submission";
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
import { CONTENT_TYPES, type ContentType } from "@/features/songs/domain/song";

export interface SubmissionSnapshotDocument {
  title: string;
  artist: string;
  originalKey: MusicalKey;
  contentType: ContentType;
  chordPro?: string;
  sourceUrl?: string;
}

export interface SubmissionVersionDocument {
  version: number;
  snapshot: SubmissionSnapshotDocument;
  sourceSongRevision: number;
  submittedAt: Date;
}

export interface SubmissionHistoryDocument {
  action: "submitted" | SubmissionAction;
  /** Conta que agiu (colaborador ou administração); só a administração vê. */
  by: string;
  actor: "author" | "admin";
  at: Date;
  version: number;
  note?: string;
  /** Pedido que gerou o reenvio: repeti-lo não cria outra versão. */
  requestId?: string;
}

export interface CatalogSubmissionDocument {
  id: string;
  /** Conta do colaborador, sempre da sessão validada. Nenhum outro dado da conta é copiado. */
  submittedBy: string;
  /** Identificador do pedido de envio, para repetir o pedido sem criar outra proposta. */
  requestId: string;
  personalSongId: string;
  sourceSongRevision: number;
  version: number;
  snapshot: SubmissionSnapshotDocument;
  previousVersions: SubmissionVersionDocument[];
  suggestedClassification: {
    moments: LiturgicalMomentId[];
    seasons: LiturgicalSeasonId[];
    celebrations: LiturgicalCelebrationId[];
    themes: BiblicalThemeId[];
  };
  videoReference: {
    provider: "youtube";
    videoId: string;
    title?: string;
    kind: VideoKind;
    ownPerformance: boolean;
  } | null;
  rightsDeclaration: {
    status: RightsStatus;
    license: { display: boolean; reproduce: boolean; redistribute: boolean };
    declarationVersion: string;
    acceptedAt: Date;
    note?: string;
  };
  publicCreditPreference: { show: boolean; name?: string };
  duplicateJustification?: string;
  message?: string;
  status: SubmissionStatus;
  review: {
    by: string;
    at: Date;
    decision: SubmissionAction;
    mode?: ApprovalMode;
    note?: string;
    /** Pedido de aprovação aplicado: repeti-lo devolve o mesmo resultado. */
    requestId?: string;
  } | null;
  resultingCatalogSongId: string | null;
  history: SubmissionHistoryDocument[];
  revision: number;
  createdAt: Date;
  submittedAt: Date;
  reviewedAt: Date | null;
  updatedAt: Date;
}

// `versionKey: false` também nos subdocumentos: ao repetir uma transação, o Mongoose restaura a
// chave de versão dos documentos criados, e o modo estrito recusaria um `__v` inexistente.
const strict = { _id: false, id: false, versionKey: false, strict: "throw" } as const;

const snapshotSchema = new Schema<SubmissionSnapshotDocument>(
  {
    title: { type: String, required: true },
    artist: { type: String, default: "" },
    originalKey: { type: String, required: true, enum: MUSICAL_KEYS },
    contentType: { type: String, required: true, enum: CONTENT_TYPES },
    chordPro: { type: String },
    sourceUrl: { type: String },
  },
  strict,
);

const submissionSchema = new Schema<CatalogSubmissionDocument>(
  {
    id: { type: String, required: true },
    submittedBy: { type: String, required: true },
    requestId: { type: String, required: true },
    personalSongId: { type: String, required: true },
    sourceSongRevision: { type: Number, required: true },
    version: { type: Number, required: true },
    snapshot: { type: snapshotSchema, required: true },
    previousVersions: {
      type: [
        new Schema<SubmissionVersionDocument>(
          {
            version: { type: Number, required: true },
            snapshot: { type: snapshotSchema, required: true },
            sourceSongRevision: { type: Number, required: true },
            submittedAt: { type: Date, required: true },
          },
          strict,
        ),
      ],
      default: [],
    },
    suggestedClassification: {
      type: new Schema(
        {
          moments: { type: [{ type: String, enum: LITURGICAL_MOMENT_IDS }], default: [] },
          seasons: { type: [{ type: String, enum: LITURGICAL_SEASON_IDS }], default: [] },
          celebrations: { type: [{ type: String, enum: LITURGICAL_CELEBRATION_IDS }], default: [] },
          themes: { type: [{ type: String, enum: BIBLICAL_THEME_IDS }], default: [] },
        },
        strict,
      ),
      required: true,
    },
    videoReference: {
      type: new Schema(
        {
          provider: { type: String, required: true, enum: ["youtube"] },
          videoId: { type: String, required: true, match: /^[A-Za-z0-9_-]{11}$/ },
          title: { type: String },
          kind: { type: String, required: true, enum: VIDEO_KINDS },
          ownPerformance: { type: Boolean, required: true },
        },
        strict,
      ),
      default: null,
    },
    rightsDeclaration: {
      type: new Schema(
        {
          status: { type: String, required: true, enum: RIGHTS_STATUSES },
          license: {
            type: new Schema(
              { display: { type: Boolean, required: true }, reproduce: { type: Boolean, required: true }, redistribute: { type: Boolean, required: true } },
              strict,
            ),
            required: true,
          },
          declarationVersion: { type: String, required: true },
          acceptedAt: { type: Date, required: true },
          note: { type: String },
        },
        strict,
      ),
      required: true,
    },
    publicCreditPreference: {
      type: new Schema({ show: { type: Boolean, required: true }, name: { type: String } }, strict),
      required: true,
    },
    duplicateJustification: { type: String },
    message: { type: String },
    status: { type: String, required: true, enum: SUBMISSION_STATUSES },
    review: {
      type: new Schema(
        {
          by: { type: String, required: true },
          at: { type: Date, required: true },
          decision: { type: String, required: true },
          mode: { type: String, enum: APPROVAL_MODES },
          note: { type: String },
          requestId: { type: String },
        },
        strict,
      ),
      default: null,
    },
    resultingCatalogSongId: { type: String, default: null },
    history: {
      type: [
        new Schema<SubmissionHistoryDocument>(
          {
            action: { type: String, required: true },
            by: { type: String, required: true },
            actor: { type: String, required: true, enum: ["author", "admin"] },
            at: { type: Date, required: true },
            version: { type: Number, required: true },
            note: { type: String },
            requestId: { type: String },
          },
          strict,
        ),
      ],
      default: [],
    },
    revision: { type: Number, required: true },
    createdAt: { type: Date, required: true },
    submittedAt: { type: Date, required: true },
    reviewedAt: { type: Date, default: null },
    updatedAt: { type: Date, required: true },
  },
  { id: false, versionKey: false, strict: "throw", collection: "catalog_submissions", autoIndex: false, autoCreate: false },
);

submissionSchema.index({ id: 1 }, { unique: true });
// Repetir o mesmo pedido de envio nunca cria outra proposta.
submissionSchema.index({ submittedBy: 1, requestId: 1 }, { unique: true });
// "Minhas sugestões" e os limites por conta.
submissionSchema.index({ submittedBy: 1, status: 1, submittedAt: -1 });
submissionSchema.index({ submittedBy: 1, personalSongId: 1, status: 1 });
// Fila da administração.
submissionSchema.index({ status: 1, submittedAt: 1, id: 1 });
// Uma música do catálogo nasce de no máximo uma proposta aprovada como nova.
submissionSchema.index(
  { resultingCatalogSongId: 1, "review.mode": 1 },
  { unique: true, partialFilterExpression: { resultingCatalogSongId: { $type: "string" }, "review.mode": "new" } },
);

export const CatalogSubmissionModel: Model<CatalogSubmissionDocument> =
  (mongoose.models.CatalogSubmission as Model<CatalogSubmissionDocument> | undefined) ??
  mongoose.model<CatalogSubmissionDocument>("CatalogSubmission", submissionSchema);

/**
 * Um documento por conta, alterado no começo de cada envio: dois envios simultâneos da mesma
 * conta entram em conflito de escrita na transação, e o segundo recalcula os limites.
 */
export interface SubmissionQuotaDocument {
  userId: string;
  lastSubmissionAt: Date;
  writes: number;
}

const quotaSchema = new Schema<SubmissionQuotaDocument>(
  {
    userId: { type: String, required: true },
    lastSubmissionAt: { type: Date, required: true },
    writes: { type: Number, required: true, default: 0 },
  },
  { id: false, versionKey: false, strict: "throw", collection: "catalog_submission_quotas", autoIndex: false, autoCreate: false },
);

quotaSchema.index({ userId: 1 }, { unique: true });

export const SubmissionQuotaModel: Model<SubmissionQuotaDocument> =
  (mongoose.models.SubmissionQuota as Model<SubmissionQuotaDocument> | undefined) ??
  mongoose.model<SubmissionQuotaDocument>("SubmissionQuota", quotaSchema);
