import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

import { LITURGICAL_MOMENT_IDS, type LiturgicalMomentId } from "@/features/liturgy/domain/vocabulary";

export interface RepertoireItemDocument {
  id: string;
  songId: string;
  /** Ausente em itens anteriores à Etapa 2E.1: valem como `personal`. */
  source?: "catalog" | "personal";
  position: number;
  notes?: string;
  transposeSemitones: number;
  /** Momento da missa; só em repertórios de missa. */
  moment?: LiturgicalMomentId;
}

export interface RepertoireMassDocument {
  date: string;
  celebrationId?: string;
  title: string;
  celebrationRevision?: number;
}

/** Formato persistido. Os itens guardam apenas referências às músicas, nunca as cifras. */
export interface RepertoireDocument {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  /** Ausente em repertórios que não são de missa, inclusive todos os anteriores à Etapa 2E.2. */
  mass?: RepertoireMassDocument;
  items: RepertoireItemDocument[];
  /** Publicações gravam aqui na transação, para conflitar com edições e exclusões simultâneas. */
  shareVersion?: number;
  /** Controle de edição. Documentos anteriores à Etapa 2D.1 não têm o campo: valem como 1. */
  revision?: number;
  createdAt: Date;
  updatedAt: Date;
}

const repertoireItemSchema = new Schema<RepertoireItemDocument>(
  {
    id: { type: String, required: true },
    songId: { type: String, required: true },
    source: { type: String, enum: ["catalog", "personal"] },
    position: { type: Number, required: true },
    notes: { type: String },
    transposeSemitones: { type: Number, required: true, default: 0 },
    moment: { type: String, enum: LITURGICAL_MOMENT_IDS },
  },
  { _id: false, id: false, strict: "throw" },
);

const repertoireMassSchema = new Schema<RepertoireMassDocument>(
  {
    date: { type: String, required: true },
    celebrationId: { type: String },
    title: { type: String, required: true },
    celebrationRevision: { type: Number },
  },
  { _id: false, id: false, strict: "throw" },
);

const repertoireSchema = new Schema<RepertoireDocument>(
  {
    id: { type: String, required: true },
    ownerId: { type: String, required: true },
    name: { type: String, required: true },
    // O domínio aceita descrição vazia; `required` do Mongoose a rejeitaria.
    description: { type: String, default: "" },
    mass: { type: repertoireMassSchema },
    items: { type: [repertoireItemSchema], default: [] },
    shareVersion: { type: Number },
    revision: { type: Number },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { id: false, versionKey: false, strict: "throw", collection: "repertoires", autoIndex: false, autoCreate: false },
);

repertoireSchema.index({ ownerId: 1, id: 1 }, { unique: true });
repertoireSchema.index({ ownerId: 1, updatedAt: -1 });

export const RepertoireModel: Model<RepertoireDocument> =
  (mongoose.models.Repertoire as Model<RepertoireDocument> | undefined) ??
  mongoose.model<RepertoireDocument>("Repertoire", repertoireSchema);
