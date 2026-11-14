import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

/**
 * Contas autorizadas a administrar o catálogo. Só um comando local de manutenção grava
 * aqui (`scripts/catalog-admin.mjs`): não há rota HTTP que conceda ou altere este papel.
 */
export interface CatalogAdminDocument {
  userId: string;
  grantedAt: Date;
  /** Registro de quem executou o comando, para auditoria. */
  grantedBy: string;
  note?: string;
}

const catalogAdminSchema = new Schema<CatalogAdminDocument>(
  {
    userId: { type: String, required: true },
    grantedAt: { type: Date, required: true },
    grantedBy: { type: String, required: true },
    note: { type: String },
  },
  { id: false, versionKey: false, strict: "throw", collection: "catalog_admins", autoIndex: false, autoCreate: false },
);

catalogAdminSchema.index({ userId: 1 }, { unique: true });

export const CatalogAdminModel: Model<CatalogAdminDocument> =
  (mongoose.models.CatalogAdmin as Model<CatalogAdminDocument> | undefined) ??
  mongoose.model<CatalogAdminDocument>("CatalogAdmin", catalogAdminSchema);
