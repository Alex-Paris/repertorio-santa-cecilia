import { z } from "zod";

import { isValidIsoDate } from "@/features/liturgy/domain/calendar";
import { LITURGICAL_MOMENT_IDS } from "@/features/liturgy/domain/vocabulary";
import { SONG_SOURCES } from "@/features/songs/domain/song";
import { entityIdSchema, revisionSchema } from "@/features/songs/domain/song-schema";
import {
  MAX_TRANSPOSE_SEMITONES,
  MIN_TRANSPOSE_SEMITONES,
} from "@/features/songs/domain/transposition";

import type {
  Repertoire,
  RepertoireRecord,
  RepertoireInput,
  RepertoireItem,
  RepertoireItemChanges,
  RepertoireMass,
} from "./repertoire";

export const MAX_ITEM_NOTES_LENGTH = 500;

const MAX_NAME_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 2000;

const INVALID_SEMITONES = `Use um deslocamento inteiro entre ${MIN_TRANSPOSE_SEMITONES} e +${MAX_TRANSPOSE_SEMITONES} semitons.`;
const NOTES_TOO_LONG = `As anotações devem ter no máximo ${MAX_ITEM_NOTES_LENGTH} caracteres.`;

const itemFields = {
  notes: z.string().trim().max(MAX_ITEM_NOTES_LENGTH, NOTES_TOO_LONG).optional(),
  transposeSemitones: z
    .number({ error: INVALID_SEMITONES })
    .int(INVALID_SEMITONES)
    .min(MIN_TRANSPOSE_SEMITONES, INVALID_SEMITONES)
    .max(MAX_TRANSPOSE_SEMITONES, INVALID_SEMITONES),
};

const momentSchema = z.enum(LITURGICAL_MOMENT_IDS, { error: "Escolha um momento da missa válido." });

/** Missa do repertório: a data precisa existir no calendário civil. */
export const repertoireMassSchema: z.ZodType<RepertoireMass> = z.strictObject({
  date: z.string().refine(isValidIsoDate, "Informe uma data válida para a celebração."),
  celebrationId: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120)
    .optional(),
  title: z
    .string({ error: "Informe o nome da celebração." })
    .trim()
    .min(1, "Informe o nome da celebração.")
    .max(MAX_NAME_LENGTH, `O nome da celebração deve ter no máximo ${MAX_NAME_LENGTH} caracteres.`),
  celebrationRevision: z.number().int().positive().optional(),
});

const inputFields = {
  name: z
    .string({ error: "Informe o nome do repertório." })
    .trim()
    .min(1, "Informe o nome do repertório.")
    .max(MAX_NAME_LENGTH, `O nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres.`),
  description: z
    .string()
    .trim()
    .max(MAX_DESCRIPTION_LENGTH, `A descrição deve ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`),
};

/** Regras dos dados informados pelo usuário: fonte única para formulário e repositório. */
export const repertoireInputSchema: z.ZodType<RepertoireInput> = z.strictObject({
  ...inputFields,
  mass: repertoireMassSchema.nullable().optional(),
});

const repertoireItemSchema: z.ZodType<RepertoireItem> = z.strictObject({
  id: entityIdSchema,
  songId: entityIdSchema,
  source: z.enum(SONG_SOURCES),
  position: z.number().int().positive(),
  ...itemFields,
  moment: momentSchema.optional(),
});

/** Regras das alterações em um item: fonte única para formulário e repositório. */
export const repertoireItemChangesSchema: z.ZodType<RepertoireItemChanges> = z.strictObject({
  notes: itemFields.notes,
  transposeSemitones: itemFields.transposeSemitones.optional(),
  moment: momentSchema.nullable().optional(),
});

const recordFields = {
  ...inputFields,
  id: entityIdSchema,
  mass: repertoireMassSchema.optional(),
  items: z.array(repertoireItemSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

/** Formato do backup e da biblioteca antiga. Não aceita `revision`: o contrato não mudou. */
export const repertoireRecordSchema: z.ZodType<RepertoireRecord> = z.strictObject(recordFields);

/** Repertório entregue pela API privada, com a revisão atual. */
export const repertoireSchema: z.ZodType<Repertoire> = z.strictObject({
  ...recordFields,
  revision: revisionSchema,
});
