import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

import { REVIEW_STATUSES, type ReviewStatus } from "@/features/liturgy/domain/calendar";
import type { CelebrationInput } from "@/features/liturgy/domain/celebration-record";

export const HISTORY_ACTIONS = ["import", "create", "update", "approve", "dispute", "resolve", "reopen"] as const;
export type HistoryAction = (typeof HISTORY_ACTIONS)[number];

/**
 * Uma alteração editorial. Guarda quem, quando, o quê e o conteúdo resultante, para explicar
 * depois por que uma sugestão apareceu. Nada de sessão, e-mail ou dados de conta além do ID.
 */
export interface CelebrationHistoryDocument {
  id: string;
  celebrationId: string;
  action: HistoryAction;
  fromRevision: number | null;
  toRevision: number;
  fromStatus: ReviewStatus | null;
  toStatus: ReviewStatus;
  changedFields: string[];
  /** ID da conta administradora, ou o nome do processo de importação. */
  actor: string;
  at: Date;
  note?: string;
  /** Na aprovação: revisão aprovada e fontes que a fundamentaram. */
  approvedRevision?: number;
  sourceIds?: string[];
  /** Conteúdo depois da alteração, nas ações que mudam o conteúdo. */
  content?: CelebrationInput;
}

const historySchema = new Schema<CelebrationHistoryDocument>(
  {
    id: { type: String, required: true },
    celebrationId: { type: String, required: true },
    action: { type: String, required: true, enum: HISTORY_ACTIONS },
    fromRevision: { type: Number, default: null },
    toRevision: { type: Number, required: true },
    fromStatus: { type: String, enum: [...REVIEW_STATUSES, null], default: null },
    toStatus: { type: String, required: true, enum: REVIEW_STATUSES },
    changedFields: { type: [String], default: [] },
    actor: { type: String, required: true },
    at: { type: Date, required: true },
    note: { type: String },
    approvedRevision: { type: Number },
    sourceIds: { type: [String], default: undefined },
    content: { type: Schema.Types.Mixed },
  },
  {
    id: false,
    versionKey: false,
    strict: "throw",
    collection: "liturgical_celebration_history",
    autoIndex: false,
    autoCreate: false,
  },
);

historySchema.index({ id: 1 }, { unique: true, name: "id_unico" });
historySchema.index({ celebrationId: 1, toRevision: 1 }, { name: "por_celebracao" });

export const CelebrationHistoryModel: Model<CelebrationHistoryDocument> =
  (mongoose.models.CelebrationHistory as Model<CelebrationHistoryDocument> | undefined) ??
  mongoose.model<CelebrationHistoryDocument>("CelebrationHistory", historySchema);
