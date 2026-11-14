import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

import {
  CELEBRATION_RANKS,
  CELEBRATION_SCOPES,
  FACT_FIELDS,
  MASS_VARIANTS,
  READING_ROLES,
  REVIEW_STATUSES,
  SOURCE_JURISDICTIONS,
  SOURCE_VERIFICATIONS,
  SUNDAY_CYCLES,
  WEEKDAY_CYCLES,
  type CelebrationSource,
  type FactField,
  type LiturgicalReading,
  type ReviewStatus,
} from "@/features/liturgy/domain/calendar";
import type { CelebrationInput } from "@/features/liturgy/domain/celebration-record";
import { BIBLE_BOOK_IDS } from "@/features/liturgy/domain/scripture";
import {
  BIBLICAL_THEME_IDS,
  LITURGICAL_CELEBRATION_IDS,
  LITURGICAL_COLORS,
  LITURGICAL_SEASON_IDS,
} from "@/features/liturgy/domain/vocabulary";

export interface CelebrationApprovalDocument {
  by: string;
  at: Date;
  revision: number;
  sourceIds: string[];
}

export interface CelebrationDisputeDocument {
  fields: FactField[];
  note: string;
  by: string;
  at: Date;
}

/**
 * Celebração do calendário litúrgico. A data é texto `AAAA-MM-DD`: é civil, e um `Date` em
 * UTC poderia mudar o dia. A identidade é o `id`; o título nunca identifica.
 */
export type LiturgicalCelebrationDocument = Omit<CelebrationInput, "diocese"> & {
  id: string;
  diocese?: string;
  /** Diocese ou texto vazio, para a unicidade valer também no calendário nacional. */
  dioceseKey: string;
  searchTokens: string[];
  reviewStatus: ReviewStatus;
  approval?: CelebrationApprovalDocument | null;
  dispute?: CelebrationDisputeDocument | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
};

const options = { _id: false, id: false, strict: "throw" } as const;

const rangeSchema = new Schema(
  {
    book: { type: String, enum: BIBLE_BOOK_IDS, required: true },
    chapter: { type: Number, required: true },
    verseStart: { type: Number },
    verseEnd: { type: Number },
  },
  options,
);

const readingSchema = new Schema<LiturgicalReading>(
  {
    role: { type: String, enum: READING_ROLES, required: true },
    citation: { type: String, required: true },
    ranges: { type: [rangeSchema], default: [] },
  },
  options,
);

const sourceSchema = new Schema<CelebrationSource>(
  {
    id: { type: String, required: true },
    provider: { type: String, required: true },
    documentTitle: { type: String, required: true },
    referenceUrl: { type: String },
    edition: { type: String },
    accessedAt: { type: String, required: true },
    jurisdiction: { type: String, enum: SOURCE_JURISDICTIONS, required: true },
    scope: { type: [{ type: String, enum: FACT_FIELDS }], default: [] },
    verificationStatus: { type: String, enum: SOURCE_VERIFICATIONS, required: true },
    note: { type: String },
  },
  options,
);

const celebrationSchema = new Schema<LiturgicalCelebrationDocument>(
  {
    id: { type: String, required: true },
    date: { type: String, required: true },
    country: { type: String, required: true, enum: ["BR"] },
    scope: { type: String, required: true, enum: CELEBRATION_SCOPES },
    diocese: { type: String },
    dioceseKey: { type: String, default: "" },
    celebrationKey: { type: String, required: true },
    massVariant: { type: String, required: true, enum: MASS_VARIANTS },
    title: { type: String, required: true },
    searchTokens: { type: [String], default: [] },
    rank: { type: String, required: true, enum: CELEBRATION_RANKS },
    season: { type: String, required: true, enum: LITURGICAL_SEASON_IDS },
    lectionaryCycle: {
      type: new Schema(
        {
          sunday: { type: String, enum: SUNDAY_CYCLES, required: true },
          weekday: { type: String, enum: [...WEEKDAY_CYCLES, null], default: null },
        },
        options,
      ),
      required: true,
    },
    liturgicalColor: {
      type: new Schema({ color: { type: String, enum: LITURGICAL_COLORS, required: true }, note: { type: String } }, options),
      default: null,
    },
    readings: { type: [readingSchema], default: [] },
    unverifiedReadings: { type: [{ type: String, enum: READING_ROLES }], default: [] },
    celebrations: { type: [{ type: String, enum: LITURGICAL_CELEBRATION_IDS }], default: [] },
    biblicalThemes: { type: [{ type: String, enum: BIBLICAL_THEME_IDS }], default: [] },
    notes: { type: [String], default: [] },
    sources: { type: [sourceSchema], default: [] },
    reviewStatus: { type: String, required: true, enum: REVIEW_STATUSES },
    approval: {
      type: new Schema(
        { by: { type: String, required: true }, at: { type: Date, required: true }, revision: { type: Number, required: true }, sourceIds: { type: [String], default: [] } },
        options,
      ),
      default: null,
    },
    dispute: {
      type: new Schema(
        { fields: { type: [{ type: String, enum: FACT_FIELDS }], default: [] }, note: { type: String, required: true }, by: { type: String, required: true }, at: { type: Date, required: true } },
        options,
      ),
      default: null,
    },
    revision: { type: Number, required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  {
    id: false,
    versionKey: false,
    strict: "throw",
    collection: "liturgical_celebrations",
    autoIndex: false,
    autoCreate: false,
  },
);

celebrationSchema.index({ id: 1 }, { unique: true, name: "id_unico" });
// Uma data pode ter várias celebrações; a mesma celebração e o mesmo formulário, só uma vez por calendário.
celebrationSchema.index(
  { country: 1, dioceseKey: 1, date: 1, celebrationKey: 1, massVariant: 1 },
  { unique: true, name: "celebracao_unica" },
);
celebrationSchema.index({ date: 1, id: 1 }, { name: "por_data" });
celebrationSchema.index({ reviewStatus: 1, date: 1 }, { name: "por_situacao" });
celebrationSchema.index({ season: 1, date: 1 }, { name: "por_tempo" });
celebrationSchema.index({ searchTokens: 1, date: 1 }, { name: "por_titulo" });

export const LiturgicalCelebrationModel: Model<LiturgicalCelebrationDocument> =
  (mongoose.models.LiturgicalCelebration as Model<LiturgicalCelebrationDocument> | undefined) ??
  mongoose.model<LiturgicalCelebrationDocument>("LiturgicalCelebration", celebrationSchema);
