import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

import type { PublicShareSnapshot } from "@/features/sharing/domain/public-share";

/** Registro da declaração feita pelo proprietário para uma cifra específica. */
export interface ShareAuthorizationDocument {
  songId: string;
  declarationVersion: string;
  confirmedAt: Date;
  songUpdatedAt: Date;
  chordProHash: string;
}

/** Origem de cada item publicado. Fica fora do `snapshot` e nunca é lida pela rota pública. */
export interface ShareSourceDocument {
  publicItemId: string;
  songId: string;
  /** Ausente nas publicações anteriores à Etapa 2E.1: valem como `personal`. */
  source?: "catalog" | "personal";
}

export interface RepertoireShareDocument {
  id: string;
  ownerId: string;
  repertoireId: string;
  name: string;
  status: "active" | "revoked";
  tokenVersion: number;
  revision: number;
  /** Cópias disputam a publicação com revogação/atualização sem mudar a revisão editorial. */
  cloneVersion?: number;
  /** Removido ao revogar: o conteúdo publicado deixa de existir. */
  snapshot?: PublicShareSnapshot;
  contentHash?: string;
  sources: ShareSourceDocument[];
  authorizations: ShareAuthorizationDocument[];
  /** O proprietário escolheu publicar a data da celebração. Ausente: não publicada. */
  includeMassDate?: boolean;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date;
  revokedAt?: Date;
}

const authorizationSchema = new Schema<ShareAuthorizationDocument>(
  {
    songId: { type: String, required: true },
    declarationVersion: { type: String, required: true },
    confirmedAt: { type: Date, required: true },
    songUpdatedAt: { type: Date, required: true },
    chordProHash: { type: String, required: true },
  },
  { _id: false, id: false, strict: "throw" },
);

const sourceSchema = new Schema<ShareSourceDocument>(
  {
    publicItemId: { type: String, required: true },
    songId: { type: String, required: true },
    source: { type: String, enum: ["catalog", "personal"] },
  },
  { _id: false, id: false, strict: "throw" },
);

const repertoireShareSchema = new Schema<RepertoireShareDocument>(
  {
    id: { type: String, required: true },
    ownerId: { type: String, required: true },
    repertoireId: { type: String, required: true },
    name: { type: String, required: true },
    status: { type: String, enum: ["active", "revoked"], required: true },
    tokenVersion: { type: Number, required: true },
    revision: { type: Number, required: true },
    cloneVersion: { type: Number },
    // Validado pelo schema público ao gravar e ao ler.
    snapshot: { type: Schema.Types.Mixed },
    contentHash: { type: String },
    sources: { type: [sourceSchema], default: [] },
    authorizations: { type: [authorizationSchema], default: [] },
    includeMassDate: { type: Boolean },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    publishedAt: { type: Date, required: true },
    revokedAt: { type: Date },
  },
  {
    id: false,
    versionKey: false,
    strict: "throw",
    minimize: false,
    collection: "repertoire_shares",
    autoIndex: false,
    autoCreate: false,
  },
);

repertoireShareSchema.index({ id: 1 }, { unique: true });
repertoireShareSchema.index({ ownerId: 1, status: 1 });
repertoireShareSchema.index({ ownerId: 1, repertoireId: 1, status: 1 });

export const RepertoireShareModel: Model<RepertoireShareDocument> =
  (mongoose.models.RepertoireShare as Model<RepertoireShareDocument> | undefined) ??
  mongoose.model<RepertoireShareDocument>("RepertoireShare", repertoireShareSchema);
