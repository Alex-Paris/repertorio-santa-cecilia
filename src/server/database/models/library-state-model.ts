import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

/**
 * Um documento por usuário. Importações e criações escrevem nele dentro da transação:
 * o conflito de escrita faz o próprio MongoDB serializar essas operações por proprietário.
 */
export interface LibraryStateDocument {
  ownerId: string;
  revision: number;
}

const libraryStateSchema = new Schema<LibraryStateDocument>(
  {
    ownerId: { type: String, required: true },
    revision: { type: Number, required: true, default: 0 },
  },
  { id: false, versionKey: false, strict: "throw", collection: "library_states", autoIndex: false, autoCreate: false },
);

libraryStateSchema.index({ ownerId: 1 }, { unique: true });

export const LibraryStateModel: Model<LibraryStateDocument> =
  (mongoose.models.LibraryState as Model<LibraryStateDocument> | undefined) ??
  mongoose.model<LibraryStateDocument>("LibraryState", libraryStateSchema);
