#!/usr/bin/env node
/**
 * Importa a base editorial de celebrações (src/features/liturgy/data/editorial-celebrations.json)
 * para a coleção `liturgical_celebrations`. Só por comando explícito:
 *
 *   pnpm liturgy:import
 *
 * - Idempotente: insere só as celebrações ausentes. Uma celebração que já existe nunca é
 *   alterada, nem se tiver sido editada ou aprovada pela administração.
 * - Toda celebração importada começa em `pending_review`: conferência automatizada não é
 *   revisão humana, e nenhuma importação aprova nada.
 * - Recusa NODE_ENV=production. Nada é apagado.
 *
 * O conteúdo do arquivo é validado pelas regras do domínio nos testes unitários
 * (src/features/liturgy/domain/calendar.test.ts); aqui só a estrutura mínima é conferida.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { withDatabase } from "./mongo-env.mjs";

const ACTOR = "importacao-editorial";
const FILE = new URL("../src/features/liturgy/data/editorial-celebrations.json", import.meta.url);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CONTENT_KEYS = [
  "date", "country", "scope", "celebrationKey", "massVariant", "title", "rank", "season", "lectionaryCycle",
  "liturgicalColor", "readings", "unverifiedReadings", "celebrations", "biblicalThemes", "notes", "sources",
];

if (process.env.NODE_ENV === "production") {
  console.error("Recusado: a importação editorial não roda em produção.");
  process.exit(1);
}

/** Mesmo critério da busca do catálogo: sem acentos, minúsculas, palavras separadas. */
function searchTokens(title) {
  const normalized = title.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").trim();
  return [...new Set(normalized.split(/[^\p{L}\p{N}]+/u).filter(Boolean))];
}

function load() {
  const document = JSON.parse(readFileSync(FILE, "utf8"));
  if (!Array.isArray(document.celebrations)) {
    throw new Error("Arquivo sem a lista `celebrations`.");
  }
  return document.celebrations.map((entry, index) => {
    const problems = [
      !SLUG.test(entry.id ?? "") && "id",
      !DATE.test(entry.date ?? "") && "date",
      !SLUG.test(entry.celebrationKey ?? "") && "celebrationKey",
      !(Array.isArray(entry.sources) && entry.sources.length > 0) && "sources",
      entry.scope === "diocesan" && "scope",
      CONTENT_KEYS.some((key) => !(key in entry)) && "campos",
    ].filter(Boolean);
    if (problems.length > 0) {
      throw new Error(`Celebração ${index + 1} inválida (${problems.join(", ")}). Nada foi importado.`);
    }
    return entry;
  });
}

const entries = load();

await withDatabase(async (db, dbName) => {
  const celebrations = db.collection("liturgical_celebrations");
  const history = db.collection("liturgical_celebration_history");
  // Os mesmos índices únicos do modelo: a unicidade vale antes da primeira inserção.
  await celebrations.createIndex({ id: 1 }, { unique: true, name: "id_unico" });
  await celebrations.createIndex(
    { country: 1, dioceseKey: 1, date: 1, celebrationKey: 1, massVariant: 1 },
    { unique: true, name: "celebracao_unica" },
  );
  await history.createIndex({ id: 1 }, { unique: true, name: "id_unico" });
  await history.createIndex({ celebrationId: 1, toRevision: 1 }, { name: "por_celebracao" });

  let inserted = 0;
  let existing = 0;
  const skipped = [];
  const session = db.client.startSession();
  try {
    for (const entry of entries) {
      const { id, ...content } = entry;
      const key = { country: content.country, dioceseKey: "", date: content.date, celebrationKey: content.celebrationKey, massVariant: content.massVariant };

      await session.withTransaction(async () => {
        // Um ID já usado por outra celebração não é reaproveitado: fica para a administração decidir.
        const clash = await celebrations.findOne({ id, $or: Object.entries(key).map(([field, value]) => ({ [field]: { $ne: value } })) }, { session, projection: { _id: 1 } });
        if (clash) {
          skipped.push(id);
          return;
        }
        const now = new Date();
        const result = await celebrations.updateOne(
          key,
          {
            $setOnInsert: {
              ...content,
              id,
              dioceseKey: "",
              searchTokens: searchTokens(content.title),
              reviewStatus: "pending_review",
              approval: null,
              dispute: null,
              revision: 1,
              createdAt: now,
              updatedAt: now,
              createdBy: ACTOR,
              updatedBy: ACTOR,
            },
          },
          { upsert: true, session },
        );
        if (result.upsertedCount === 0) {
          existing += 1;
          return;
        }
        inserted += 1;
        await history.insertOne(
          {
            id: randomUUID(),
            celebrationId: id,
            action: "import",
            fromRevision: null,
            toRevision: 1,
            fromStatus: null,
            toStatus: "pending_review",
            changedFields: [...CONTENT_KEYS].sort(),
            actor: ACTOR,
            at: now,
            note: "Importação da base editorial da Etapa 2E.2. Conferência automatizada, sem revisão humana.",
            content,
          },
          { session },
        );
      });
    }
  } finally {
    await session.endSession();
  }

  console.log(
    `${dbName}: ${inserted} celebração(ões) importada(s) em revisão; ${existing} já existiam e não foram alteradas.` +
      (skipped.length ? ` Ignoradas por conflito de identificador: ${skipped.join(", ")}.` : ""),
  );
});
