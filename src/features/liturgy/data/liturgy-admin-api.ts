import { z } from "zod";

import { createLibraryApi } from "@/features/library/data/remote/library-api";

import {
  CELEBRATION_RANKS,
  CELEBRATION_SCOPES,
  FACT_FIELDS,
  MASS_VARIANTS,
  REVIEW_STATUSES,
  type CelebrationPage,
  type CelebrationQuery,
} from "../domain/calendar";
import { celebrationInputSchema, type CelebrationInput, type CelebrationRecord } from "../domain/celebration-record";
import type { ReviewRequest } from "../domain/review";
import { liturgyPrefillSchema } from "../domain/prefill";
import { DISCARD_RULE_LABELS, type MomentDiagnosis } from "../domain/recommendation";
import { LITURGICAL_COLORS, LITURGICAL_MOMENT_IDS, LITURGICAL_SEASON_IDS } from "../domain/vocabulary";

const recordSchema: z.ZodType<CelebrationRecord> = z.intersection(
  celebrationInputSchema,
  z.object({
    id: z.string(),
    reviewStatus: z.enum(REVIEW_STATUSES),
    approval: z
      .object({ by: z.string(), at: z.string(), revision: z.number(), sourceIds: z.array(z.string()) })
      .nullable(),
    dispute: z
      .object({ fields: z.array(z.enum(FACT_FIELDS)), note: z.string(), by: z.string(), at: z.string() })
      .nullable(),
    revision: z.number().int().positive(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
) as z.ZodType<CelebrationRecord>;

const summarySchema = z.object({
  celebrationId: z.string(),
  date: z.string(),
  title: z.string(),
  massVariant: z.enum(MASS_VARIANTS),
  season: z.enum(LITURGICAL_SEASON_IDS),
  rank: z.enum(CELEBRATION_RANKS),
  scope: z.enum(CELEBRATION_SCOPES),
  diocese: z.string().optional(),
  revision: z.number(),
  reviewStatus: z.enum(REVIEW_STATUSES),
  color: z.enum(LITURGICAL_COLORS).nullable(),
});

const pageSchema: z.ZodType<CelebrationPage> = z.object({
  celebrations: z.array(summarySchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

const historyEntrySchema = z.object({
  id: z.string(),
  celebrationId: z.string(),
  action: z.string(),
  fromRevision: z.number().nullable(),
  toRevision: z.number(),
  fromStatus: z.enum(REVIEW_STATUSES).nullable(),
  toStatus: z.enum(REVIEW_STATUSES),
  changedFields: z.array(z.string()),
  actor: z.string(),
  at: z.string(),
  note: z.string().optional(),
  approvedRevision: z.number().optional(),
  sourceIds: z.array(z.string()).optional(),
});

export type CelebrationHistoryItem = z.infer<typeof historyEntrySchema>;

const celebrationResponse = z.object({ celebration: recordSchema });

/** Cliente da administração litúrgica: mesma proteção de identidade e de revisão da biblioteca. */
export function createLiturgyAdminApi(userId: string) {
  const api = createLibraryApi({ userId, basePath: "/api/v1/admin/liturgy" });
  const path = (id: string) => `/celebrations/${encodeURIComponent(id)}`;

  return {
    prefill: (date: string, signal?: AbortSignal) =>
      api.request(`/prefill?date=${encodeURIComponent(date)}`, liturgyPrefillSchema, { signal }),
    list: async (query: Partial<CelebrationQuery>) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== "") {
          params.set(key, String(value));
        }
      }
      return api.request(`/celebrations?${params}`, pageSchema);
    },
    get: async (id: string) => (await api.request(path(id), celebrationResponse)).celebration,
    create: async (input: CelebrationInput) =>
      (await api.request("/celebrations", celebrationResponse, { method: "POST", body: { celebration: input } })).celebration,
    update: async (record: CelebrationRecord, input: CelebrationInput) =>
      (
        await api.request(path(record.id), celebrationResponse, {
          method: "PUT",
          body: { celebration: input },
          ifMatch: record.revision,
        })
      ).celebration,
    review: async (record: CelebrationRecord, request: ReviewRequest) =>
      (
        await api.request(`${path(record.id)}/review`, celebrationResponse, {
          method: "POST",
          body: request,
          ifMatch: record.revision,
        })
      ).celebration,
    history: async (id: string) =>
      (await api.request(`${path(id)}/history`, z.object({ history: z.array(historyEntrySchema) }))).history,
    /** Quantas músicas cada momento recebe e por que as demais ficam de fora. */
    diagnostics: async (id: string) => api.request(`${path(id)}/diagnostics`, diagnosticsSchema),
  };
}

export type LiturgyAdminApi = ReturnType<typeof createLiturgyAdminApi>;

const DISCARD_RULES = Object.keys(DISCARD_RULE_LABELS) as [keyof typeof DISCARD_RULE_LABELS, ...(keyof typeof DISCARD_RULE_LABELS)[]];

const diagnosticsSchema = z.object({
  truncated: z.boolean(),
  moments: z.array(
    z.object({
      moment: z.enum(LITURGICAL_MOMENT_IDS),
      classified: z.number(),
      eligible: z.number(),
      reviewed: z.number(),
      withChordPro: z.number(),
      discarded: z.partialRecord(z.enum(DISCARD_RULES), z.number()),
    }),
  ) as z.ZodType<MomentDiagnosis[]>,
});

export type CelebrationDiagnostics = z.infer<typeof diagnosticsSchema>;

