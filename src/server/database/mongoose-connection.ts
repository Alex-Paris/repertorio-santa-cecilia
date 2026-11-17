import "server-only";

import mongoose, { type Model } from "mongoose";

import { getServerEnv } from "@/server/env";

import { LibraryImportModel } from "./models/library-import-model";
import { LibraryStateModel } from "./models/library-state-model";
import { RepertoireModel } from "./models/repertoire-model";
import { CatalogAdminModel } from "./models/catalog-admin-model";
import { CatalogSongModel } from "./models/catalog-song-model";
import { CatalogSubmissionModel, SubmissionQuotaModel } from "./models/catalog-submission-model";
import { CelebrationHistoryModel } from "./models/liturgical-celebration-history-model";
import { LiturgicalCelebrationModel } from "./models/liturgical-celebration-model";
import { RepertoireShareModel } from "./models/repertoire-share-model";
import { ShareRateLimitModel } from "./models/share-rate-limit-model";
import { SongModel } from "./models/song-model";

const globalForMongoose = globalThis as typeof globalThis & {
  __repertorioMongooseConnection?: Promise<typeof mongoose>;
};

async function openConnection(): Promise<typeof mongoose> {
  const { MONGODB_URI, MONGODB_DB_NAME } = getServerEnv();

  await mongoose.connect(MONGODB_URI, {
    dbName: MONGODB_DB_NAME,
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
  });

  // A unicidade por usuário depende dos índices, que precisam existir antes da primeira escrita.
  // Não usa `Model.init()`: ele é memorizado e não se recuperaria de uma falha de conexão.
  const models = [
    SongModel,
    RepertoireModel,
    LibraryStateModel,
    LibraryImportModel,
    RepertoireShareModel,
    ShareRateLimitModel,
    CatalogSongModel,
    CatalogAdminModel,
    LiturgicalCelebrationModel,
    CelebrationHistoryModel,
    CatalogSubmissionModel,
    SubmissionQuotaModel,
  ];
  for (const model of models as Model<unknown>[]) {
    await model.createCollection();
    await model.createIndexes();
  }
  return mongoose;
}

/** Conexão única dos dados da aplicação. Após uma falha, a próxima chamada tenta de novo. */
export function connectToMongoose(): Promise<typeof mongoose> {
  globalForMongoose.__repertorioMongooseConnection ??= openConnection().catch((error: unknown) => {
    globalForMongoose.__repertorioMongooseConnection = undefined;
    throw error;
  });
  return globalForMongoose.__repertorioMongooseConnection;
}

export async function closeMongoose(): Promise<void> {
  globalForMongoose.__repertorioMongooseConnection = undefined;
  await mongoose.disconnect();
}
