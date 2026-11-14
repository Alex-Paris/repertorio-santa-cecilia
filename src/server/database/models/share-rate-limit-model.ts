import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

/** Contador por usuário e janela. Fica no banco para valer entre várias instâncias. */
export interface ShareRateLimitDocument {
  ownerId: string;
  window: number;
  count: number;
  expiresAt: Date;
}

const shareRateLimitSchema = new Schema<ShareRateLimitDocument>(
  {
    ownerId: { type: String, required: true },
    window: { type: Number, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  {
    id: false,
    versionKey: false,
    strict: "throw",
    collection: "share_rate_limits",
    autoIndex: false,
    autoCreate: false,
  },
);

shareRateLimitSchema.index({ ownerId: 1, window: 1 }, { unique: true });
shareRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ShareRateLimitModel: Model<ShareRateLimitDocument> =
  (mongoose.models.ShareRateLimit as Model<ShareRateLimitDocument> | undefined) ??
  mongoose.model<ShareRateLimitDocument>("ShareRateLimit", shareRateLimitSchema);
