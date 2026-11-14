import { MongoClient } from "mongodb";

/** Mesmas variáveis da aplicação. Fora do Docker, lê o `.env` local se elas não existirem. */
export function readMongoEnv() {
  if (!process.env.MONGODB_URI) {
    try {
      process.loadEnvFile(".env");
    } catch {
      // Sem arquivo: segue para a mensagem abaixo.
    }
  }
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;
  if (!uri || !dbName) {
    console.error("Defina MONGODB_URI e MONGODB_DB_NAME.");
    process.exit(1);
  }
  return { uri, dbName };
}

export async function withDatabase(action) {
  const { uri, dbName } = readMongoEnv();
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    return await action(client.db(dbName), dbName);
  } finally {
    await client.close();
  }
}
