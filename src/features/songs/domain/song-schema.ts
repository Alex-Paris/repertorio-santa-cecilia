import { z } from "zod";

import { isSafeExternalUrl } from "@/lib/utils/is-safe-external-url";

import { MUSICAL_KEYS } from "./musical-key";
import type { CatalogSongInputData, Song, SongInput, SongRecord } from "./song";

const INVALID_CONTENT_TYPE = "Escolha um tipo de conteúdo válido.";

const MAX_TEXT_LENGTH = 300;
const MAX_CHORDPRO_LENGTH = 100_000;
const MAX_URL_LENGTH = 2048;
const MAX_ID_LENGTH = 128;

/** Identificadores públicos são strings estáveis, tanto localmente quanto no MongoDB. */
export const entityIdSchema = z.string().min(1).max(MAX_ID_LENGTH);

const commonInputFields = {
  title: z
    .string({ error: "Informe o título." })
    .trim()
    .min(1, "Informe o título.")
    .max(MAX_TEXT_LENGTH, `O título deve ter no máximo ${MAX_TEXT_LENGTH} caracteres.`),
  artist: z
    .string({ error: "Informe o artista." })
    .trim()
    .min(1, "Informe o artista.")
    .max(MAX_TEXT_LENGTH, `O artista deve ter no máximo ${MAX_TEXT_LENGTH} caracteres.`),
  originalKey: z.enum(MUSICAL_KEYS, { error: "Escolha um tom válido." }),
};

const hostedSongInput = z.strictObject({
  ...commonInputFields,
  contentType: z.enum(["original", "authorized"]),
  chordPro: z
    .string()
    .max(MAX_CHORDPRO_LENGTH, `A cifra deve ter no máximo ${MAX_CHORDPRO_LENGTH} caracteres.`)
    .optional(),
});

const externalLinkSongInput = z.strictObject({
  ...commonInputFields,
  contentType: z.literal("external-link"),
  sourceUrl: z
    .string({ error: "Informe o link da fonte original." })
    .trim()
    .min(1, "Informe o link da fonte original.")
    .max(MAX_URL_LENGTH, `O link deve ter no máximo ${MAX_URL_LENGTH} caracteres.`)
    .refine(isSafeExternalUrl, "Use um link completo, começando com http:// ou https://."),
});

const managedFields = {
  id: entityIdSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

/** Regras dos dados informados pelo usuário: fonte única para formulário e repositório. */
export const songInputSchema: z.ZodType<SongInput> = z.discriminatedUnion(
  "contentType",
  [hostedSongInput, externalLinkSongInput],
  { error: INVALID_CONTENT_TYPE },
);

const metadataOnlySongInput = z.strictObject({
  title: commonInputFields.title,
  // Autoria não confirmada pela fonte fica pendente: texto vazio, nunca um nome suposto.
  artist: z.string().trim().max(MAX_TEXT_LENGTH, `O artista deve ter no máximo ${MAX_TEXT_LENGTH} caracteres.`),
  originalKey: commonInputFields.originalKey.optional(),
  contentType: z.literal("metadata-only"),
});

/** Dados musicais do catálogo: os mesmos de uma música particular, mais a variante só com metadados. */
export const catalogSongDataSchema: z.ZodType<CatalogSongInputData> = z.discriminatedUnion(
  "contentType",
  [hostedSongInput, externalLinkSongInput, metadataOnlySongInput],
  { error: INVALID_CONTENT_TYPE },
);

/** Revisão de um documento: inteiro positivo, controlado pelo servidor. */
export const revisionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

/** Formato do backup e da biblioteca antiga. Não aceita `revision`: o contrato não mudou. */
export const songRecordSchema: z.ZodType<SongRecord> = z.discriminatedUnion(
  "contentType",
  [hostedSongInput.extend(managedFields), externalLinkSongInput.extend(managedFields)],
  { error: INVALID_CONTENT_TYPE },
);

/** Música entregue pela API privada, com a revisão atual. */
export const songSchema: z.ZodType<Song> = z.discriminatedUnion(
  "contentType",
  [
    hostedSongInput.extend({ ...managedFields, revision: revisionSchema }),
    externalLinkSongInput.extend({ ...managedFields, revision: revisionSchema }),
  ],
  { error: INVALID_CONTENT_TYPE },
);
