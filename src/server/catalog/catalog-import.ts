import "server-only";

import {
  buildImportPreview,
  catalogImportDocumentSchema,
  type ImportPreview,
} from "@/features/catalog/domain/catalog-import";
import { buildSearchTokens, buildSortTitle } from "@/features/catalog/domain/catalog-search";
import { LibraryError } from "@/features/library/domain/library-errors";
import { createId } from "@/lib/utils/create-id";
import { CatalogSongModel } from "@/server/database/models/catalog-song-model";
import { runPersistence } from "@/server/repositories/persistence";

const DUPLICATE_KEY = 11000;

function parseDocument(document: unknown) {
  const parsed = catalogImportDocumentSchema.safeParse(document);
  if (!parsed.success) {
    throw new LibraryError("invalid-data", parsed.error.issues[0]?.message ?? "Arquivo de importação inválido.");
  }
  return parsed.data;
}

async function existingSongs() {
  const documents = await CatalogSongModel.find({}, { _id: 0, id: 1, title: 1, artist: 1, importKey: 1 }).lean();
  return documents.map(({ id, title, artist, importKey }) => ({ id, title, artist, ...(importKey ? { importKey } : {}) }));
}

/** Prévia: valida, mostra fontes e aponta duplicatas. Não grava nada. */
export function previewCatalogImport(document: unknown): Promise<ImportPreview> {
  const { records } = parseDocument(document);
  return runPersistence(async () => buildImportPreview(records, await existingSongs()));
}

export interface ImportResult extends ImportPreview {
  created: { id: string; importKey: string; title: string }[];
}

/**
 * Cria rascunhos só para os registros novos da prévia, refeita no servidor. Nada existente é
 * alterado; os direitos dos rascunhos são os mínimos (só metadados, link oculto) até a
 * administração decidir. Repetir a importação não cria nada: a chave é única no banco.
 */
export function commitCatalogImport(document: unknown, adminUserId: string): Promise<ImportResult> {
  const { records } = parseDocument(document);
  return runPersistence(async () => {
    const preview = buildImportPreview(records, await existingSongs());
    const created: ImportResult["created"] = [];

    for (const entry of preview.entries) {
      if (entry.status !== "new" || !entry.record) {
        continue;
      }
      const { record, classification } = entry;
      const now = new Date();
      const id = createId();
      try {
        await CatalogSongModel.create([
          {
            id,
            importKey: record.importKey,
            title: record.title,
            artist: record.artist,
            ...(record.originalKey ? { originalKey: record.originalKey } : {}),
            contentType: record.contentType,
            ...(record.sourceUrl ? { sourceUrl: record.sourceUrl } : {}),
            ...(record.compositionReference ? { compositionReference: record.compositionReference } : {}),
            metadataSources: record.metadataSources,
            searchTokens: buildSearchTokens(record.title, record.artist),
            sortTitle: buildSortTitle(record.title),
            status: "draft",
            rights: {
              basis: record.contentType === "external-link" ? "external-reference" : "public-metadata",
              evidence: `Importação editorial de metadados (sem letra nem cifra). Fontes: ${record.metadataSources.map((source) => source.title).join("; ")}.`,
              displayChordPro: false,
              shareChordPro: false,
              // Mostrar o link externo é uma decisão da administração, depois da importação.
              linkExternalSource: false,
              approvedBy: adminUserId,
              approvedAt: now,
            },
            ...(classification
              ? {
                  liturgy: {
                    ...classification,
                    classifiedBy: "importacao-editorial",
                    classifiedAt: now,
                    // Classificação importada nunca é conferida: isso exige uma pessoa.
                    reviewStatus: "pending_review",
                    review: null,
                    dispute: null,
                  },
                }
              : {}),
            revision: 1,
            createdAt: now,
            updatedAt: now,
          },
        ]);
        created.push({ id, importKey: record.importKey, title: record.title });
      } catch (error) {
        // Outra importação simultânea criou a mesma chave: o registro já existe, nada a fazer.
        if ((error as { code?: number }).code !== DUPLICATE_KEY) {
          throw error;
        }
      }
    }
    return { ...preview, created };
  });
}
