import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

/** Resultado de uma importação concluída. Guarda o hash do conteúdo, nunca o backup. */
export interface LibraryImportDocument {
  ownerId: string;
  importId: string;
  contentHash: string;
  schemaVersion: number;
  songs: number;
  repertoires: number;
  items: number;
  completedAt: Date;
}

const libraryImportSchema = new Schema<LibraryImportDocument>(
  {
    ownerId: { type: String, required: true },
    importId: { type: String, required: true },
    contentHash: { type: String, required: true },
    schemaVersion: { type: Number, required: true },
    songs: { type: Number, required: true },
    repertoires: { type: Number, required: true },
    items: { type: Number, required: true },
    completedAt: { type: Date, required: true },
  },
  { id: false, versionKey: false, strict: "throw", collection: "library_imports", autoIndex: false, autoCreate: false },
);

libraryImportSchema.index({ ownerId: 1, importId: 1 }, { unique: true });

export const LibraryImportModel: Model<LibraryImportDocument> =
  (mongoose.models.LibraryImport as Model<LibraryImportDocument> | undefined) ??
  mongoose.model<LibraryImportDocument>("LibraryImport", libraryImportSchema);
