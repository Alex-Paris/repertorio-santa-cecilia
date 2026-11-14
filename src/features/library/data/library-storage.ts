import { z } from "zod";

import { repertoireRecordSchema } from "@/features/repertoires/domain/repertoire-schema";
import { songRecordSchema } from "@/features/songs/domain/song-schema";

import { findLibraryIntegrityIssues, type LibraryRecord } from "../domain/library";

/** Chave de instalações antigas. Lida apenas para recuperação; o aplicativo não grava nela. */
export const LIBRARY_STORAGE_KEY = "repertorio.biblioteca.v1";
/**
 * Versão 2: cada item informa a origem da música (`source`). A versão 1 não tinha o campo,
 * e todos os seus itens apontam para músicas particulares.
 * Versão 3: repertórios podem guardar a missa a que se destinam (`mass`) e cada item, o
 * momento litúrgico (`moment`). As versões anteriores não conheciam esses campos.
 */
export const CURRENT_SCHEMA_VERSION = 3;

/** Subconjunto da API `Storage` usado pelo adaptador. */
export type StorageLike = Pick<Storage, "getItem">;

/** Obtém o armazenamento. Pode lançar erro: o simples acesso a `localStorage` às vezes é bloqueado. */
export type StorageProvider = () => StorageLike;

const libraryEnvelopeSchema = z
  .strictObject({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    songs: z.array(songRecordSchema),
    repertoires: z.array(repertoireRecordSchema),
  })
  .superRefine((envelope, context) => {
    findLibraryIntegrityIssues(envelope).forEach((message) => {
      context.addIssue({ code: "custom", message });
    });
  });

export type LibraryMigration = (
  document: Record<string, unknown>,
) => Record<string, unknown>;

/**
 * Migrações por versão de origem: `{ 1: (v1) => v2 }`. Ao criar uma nova versão,
 * registre aqui a conversão a partir da anterior e incremente `CURRENT_SCHEMA_VERSION`.
 */
export const LIBRARY_MIGRATIONS: Record<number, LibraryMigration> = {
  1: migrateFromVersion1,
  2: migrateFromVersion2,
};

/** A versão 2 não tinha dados de missa: o conteúdo segue igual, e esses campos são recusados. */
function migrateFromVersion2(document: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(document.repertoires)) {
    return document;
  }
  for (const repertoire of document.repertoires as unknown[]) {
    if (!isRecord(repertoire)) {
      continue;
    }
    const items = Array.isArray(repertoire.items) ? (repertoire.items as unknown[]) : [];
    if ("mass" in repertoire || items.some((item) => isRecord(item) && "moment" in item)) {
      throw new Error("dados de missa não existem antes da versão 3");
    }
  }
  return document;
}

/** Itens da versão 1 apontam sempre para a biblioteca particular. */
function migrateFromVersion1(document: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(document.repertoires)) {
    return document;
  }

  return {
    ...document,
    repertoires: document.repertoires.map((repertoire: unknown) => {
      if (!isRecord(repertoire) || !Array.isArray(repertoire.items)) {
        return repertoire;
      }
      return {
        ...repertoire,
        items: repertoire.items.map((item: unknown) => {
          // A versão 1 não conhecia o catálogo: uma referência a ele aqui é inválida.
          if (isRecord(item) && "source" in item && item.source !== "personal") {
            throw new Error("origem inválida para a versão 1");
          }
          return isRecord(item) ? { ...item, source: "personal" } : item;
        }),
      };
    }),
  };
}

/** Aplica as migrações sem validar. Serve para comparar o que foi enviado com o resultado. */
export function migrateLibraryDocument(document: Record<string, unknown>): Record<string, unknown> {
  let current = document;
  let version = document.schemaVersion as number;
  while (version < CURRENT_SCHEMA_VERSION && LIBRARY_MIGRATIONS[version]) {
    current = { ...LIBRARY_MIGRATIONS[version](current), schemaVersion: version + 1 };
    version += 1;
  }
  return current;
}

export type LibraryParseResult =
  | { status: "ok"; library: LibraryRecord }
  /** `issue`, quando presente, é uma explicação em português segura para exibição. */
  | { status: "invalid"; issue?: string }
  | { status: "newer-version" };

const INVALID: LibraryParseResult = { status: "invalid" };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Único caminho de validação de documentos: aplica migrações e confere o formato atual. */
export function parseLibraryDocument(
  document: unknown,
  migrations: Record<number, LibraryMigration> = LIBRARY_MIGRATIONS,
): LibraryParseResult {
  if (!isRecord(document) || !Number.isInteger(document.schemaVersion)) {
    return INVALID;
  }

  let current = document;
  let version = document.schemaVersion as number;

  if (version > CURRENT_SCHEMA_VERSION) {
    return { status: "newer-version" };
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (!migrate) {
      return { status: "invalid", issue: "A versão deste arquivo não é suportada." };
    }
    try {
      current = { ...migrate(current), schemaVersion: version + 1 };
    } catch {
      return INVALID;
    }
    version += 1;
  }

  const result = libraryEnvelopeSchema.safeParse(current);
  if (!result.success) {
    // Só regras próprias têm mensagem em português pensada para o usuário.
    return { status: "invalid", issue: result.error.issues.find((i) => i.code === "custom")?.message };
  }

  return {
    status: "ok",
    library: { songs: result.data.songs, repertoires: result.data.repertoires },
  };
}

export function parseJsonDocument(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export type StoredLibraryRead =
  | { status: "empty" }
  | { status: "unavailable" }
  | { status: "ok"; library: LibraryRecord; raw: string }
  | { status: "invalid"; raw: string }
  | { status: "newer-version"; raw: string };

export function readStoredLibrary(getStorage: StorageProvider): StoredLibraryRead {
  let raw: string | null;

  try {
    raw = getStorage().getItem(LIBRARY_STORAGE_KEY);
  } catch {
    return { status: "unavailable" };
  }

  if (raw === null) {
    return { status: "empty" };
  }

  return { ...parseLibraryDocument(parseJsonDocument(raw)), raw };
}
