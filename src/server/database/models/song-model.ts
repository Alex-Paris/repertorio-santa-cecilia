import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

import { MUSICAL_KEYS, type MusicalKey } from "@/features/songs/domain/musical-key";
import { CONTENT_TYPES, type ContentType } from "@/features/songs/domain/song";

/** Formato persistido. As regras de negócio ficam nos esquemas Zod do domínio. */
export interface SongDocument {
  id: string;
  ownerId: string;
  title: string;
  artist: string;
  originalKey: MusicalKey;
  contentType: ContentType;
  chordPro?: string;
  sourceUrl?: string;
  /** Incrementado ao entrar em um repertório, para conflitar com uma exclusão simultânea. */
  referenceVersion: number;
  /** Controle de edição. Documentos anteriores à Etapa 2D.1 não têm o campo: valem como 1. */
  revision?: number;
  createdAt: Date;
  updatedAt: Date;
}

const songSchema = new Schema<SongDocument>(
  {
    id: { type: String, required: true },
    ownerId: { type: String, required: true },
    title: { type: String, required: true },
    artist: { type: String, required: true },
    originalKey: { type: String, required: true, enum: MUSICAL_KEYS },
    contentType: { type: String, required: true, enum: CONTENT_TYPES },
    chordPro: { type: String },
    sourceUrl: { type: String },
    referenceVersion: { type: Number, required: true, default: 0 },
    revision: { type: Number },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { id: false, versionKey: false, strict: "throw", collection: "songs", autoIndex: false, autoCreate: false },
);

songSchema.index({ ownerId: 1, id: 1 }, { unique: true });
songSchema.index({ ownerId: 1, title: 1 });

export const SongModel: Model<SongDocument> =
  (mongoose.models.Song as Model<SongDocument> | undefined) ??
  mongoose.model<SongDocument>("Song", songSchema);
