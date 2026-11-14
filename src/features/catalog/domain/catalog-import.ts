import { z } from "zod";

import {
  EMPTY_CLASSIFICATION_INPUT,
  songClassificationInputSchema,
  type SongClassificationInput,
} from "@/features/liturgy/domain/classification";
import { MUSICAL_KEYS, type MusicalKey } from "@/features/songs/domain/musical-key";
import { isSafeExternalUrl } from "@/lib/utils/is-safe-external-url";

import { buildSortTitle } from "./catalog-search";
import { catalogMetadataSourceSchema, type CatalogMetadataSource } from "./catalog-song";

export const IMPORT_FORMAT = "repertorio-web/catalogo-editorial";
export const MAX_IMPORT_RECORDS = 200;

/**
 * Um registro de metadados. A importação nunca traz letra nem cifra: só título, autoria,
 * referência, fontes e, opcionalmente, uma classificação que entra como não conferida.
 */
export interface CatalogImportRecord {
  /** Chave estável: importar de novo o mesmo registro não cria outra música. */
  importKey: string;
  title: string;
  /** Vazio quando a fonte não confirma a autoria. */
  artist: string;
  originalKey?: MusicalKey;
  contentType: "metadata-only" | "external-link";
  sourceUrl?: string;
  compositionReference?: string;
  metadataSources: CatalogMetadataSource[];
  classification?: Partial<SongClassificationInput>;
}

const recordSchema: z.ZodType<CatalogImportRecord> = z
  .strictObject({
    importKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Chave de importação inválida.").max(120),
    title: z.string().trim().min(1, "Informe o título.").max(300),
    artist: z.string().trim().max(300),
    originalKey: z.enum(MUSICAL_KEYS).optional(),
    contentType: z.enum(["metadata-only", "external-link"], { error: "A importação aceita só metadados ou link externo." }),
    sourceUrl: z.string().trim().max(2048).refine(isSafeExternalUrl, "Use um link http(s).").optional(),
    compositionReference: z.string().trim().min(1).max(300).optional(),
    metadataSources: z.array(catalogMetadataSourceSchema).min(1, "Registre ao menos uma fonte consultada.").max(10),
    classification: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((record) => (record.contentType === "external-link") === (record.sourceUrl !== undefined), {
    message: "O link externo é obrigatório no tipo link externo, e só nele.",
    path: ["sourceUrl"],
  }) as z.ZodType<CatalogImportRecord>;

export const catalogImportDocumentSchema = z.strictObject({
  format: z.literal(IMPORT_FORMAT, { error: "Formato de arquivo desconhecido." }),
  version: z.literal(1),
  description: z.string().max(2000).optional(),
  records: z.array(z.unknown()).min(1, "O arquivo não tem registros.").max(MAX_IMPORT_RECORDS, `Use no máximo ${MAX_IMPORT_RECORDS} registros por importação.`),
});

export type CatalogImportDocument = z.infer<typeof catalogImportDocumentSchema>;

export type ImportRecordStatus = "new" | "existing" | "duplicate" | "invalid";

export interface ImportPreviewEntry {
  index: number;
  importKey: string | null;
  title: string;
  artist: string;
  status: ImportRecordStatus;
  /** Por que o registro não será criado. */
  reason?: string;
  sources: CatalogMetadataSource[];
  /** Música existente com a mesma chave ou o mesmo título e autoria. */
  existing?: { id: string; title: string; artist: string };
  record?: CatalogImportRecord;
  classification?: SongClassificationInput;
}

export interface ImportPreview {
  entries: ImportPreviewEntry[];
  counts: Record<ImportRecordStatus, number>;
}

/** Título e autoria comparáveis: sem acentos, caixa ou espaços. */
export function duplicateKey(title: string, artist: string): string {
  return `${buildSortTitle(title)}|${buildSortTitle(artist)}`;
}

/** Duas músicas parecem a mesma quando o título coincide e a autoria não diverge. */
export function looksDuplicated(a: { title: string; artist: string }, b: { title: string; artist: string }): boolean {
  if (buildSortTitle(a.title) !== buildSortTitle(b.title)) {
    return false;
  }
  const [artistA, artistB] = [buildSortTitle(a.artist), buildSortTitle(b.artist)];
  return !artistA || !artistB || artistA === artistB;
}

function parseClassification(value: unknown): { ok: true; value?: SongClassificationInput } | { ok: false; message: string } {
  if (value === undefined) {
    return { ok: true };
  }
  const parsed = songClassificationInputSchema.safeParse({ ...EMPTY_CLASSIFICATION_INPUT, ...(value as object) });
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, message: parsed.error.issues[0]?.message ?? "Classificação inválida." };
}

export interface ExistingSong {
  id: string;
  title: string;
  artist: string;
  importKey?: string;
}

/**
 * Prévia da importação: o que será criado, o que já existe e o que parece duplicado. Nada é
 * gravado aqui. A mesma função decide o que a confirmação cria, para a prévia não mentir.
 */
export function buildImportPreview(records: readonly unknown[], existing: readonly ExistingSong[]): ImportPreview {
  const byKey = new Map(existing.filter((song) => song.importKey).map((song) => [song.importKey as string, song]));
  const accepted: { importKey: string; title: string; artist: string }[] = [];
  const entries = records.map((raw, index): ImportPreviewEntry => {
    const candidate = (raw ?? {}) as Partial<CatalogImportRecord>;
    const base = {
      index,
      importKey: typeof candidate.importKey === "string" ? candidate.importKey : null,
      title: typeof candidate.title === "string" ? candidate.title : "",
      artist: typeof candidate.artist === "string" ? candidate.artist : "",
      sources: Array.isArray(candidate.metadataSources) ? (candidate.metadataSources as CatalogMetadataSource[]) : [],
    };

    const parsed = recordSchema.safeParse(raw);
    if (!parsed.success) {
      return { ...base, status: "invalid", reason: parsed.error.issues[0]?.message ?? "Registro inválido." };
    }
    const record = parsed.data;
    const classification = parseClassification(record.classification);
    if (!classification.ok) {
      return { ...base, status: "invalid", reason: `Classificação: ${classification.message}` };
    }

    const sameKey = byKey.get(record.importKey);
    if (sameKey) {
      return { ...base, status: "existing", reason: "Já importada antes: nada será alterado.", existing: sameKey };
    }
    const inFile = accepted.find((other) => other.importKey === record.importKey || looksDuplicated(other, record));
    if (inFile) {
      return { ...base, status: "duplicate", reason: `Repetida no arquivo (${inFile.importKey}).` };
    }
    const similar = existing.find((song) => looksDuplicated(song, record));
    if (similar) {
      return {
        ...base,
        status: "duplicate",
        reason: "Já existe uma música com o mesmo título e autoria compatível. Confira antes de importar.",
        existing: similar,
      };
    }
    accepted.push(record);
    return { ...base, status: "new", record, ...(classification.value ? { classification: classification.value } : {}) };
  });

  const counts: Record<ImportRecordStatus, number> = { new: 0, existing: 0, duplicate: 0, invalid: 0 };
  for (const entry of entries) {
    counts[entry.status] += 1;
  }
  return { entries, counts };
}
