import { z } from "zod";

import { catalogSongSchema } from "@/features/catalog/domain/catalog-song";
import { createLibraryApi, type FetchLike } from "@/features/library/data/remote/library-api";

import {
  RIGHTS_STATUSES,
  SUBMISSION_STATUSES,
  VIDEO_KINDS,
  submissionSnapshotSchema,
  suggestedClassificationSchema,
  type AdminSubmission,
  type AdminSubmissionSummary,
  type ApprovalRequest,
  type MySubmission,
  type ResubmissionRequest,
  type SubmissionPreview,
  type SubmissionRequest,
  type SubmissionSummary,
} from "../domain/submission";

/** Respostas da API validadas antes do uso: dados remotos não são confiáveis até serem interpretados. */
const iso = z.string();
const status = z.enum(SUBMISSION_STATUSES);
const action = z.enum(["submitted", "approve", "reject", "request_changes", "withdraw", "resubmit"]);
const duplicate = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  status: z.string(),
  kind: z.enum(["same-song", "same-title"]),
});
const resulting = z.object({ id: z.string(), title: z.string(), published: z.boolean() });

const mySubmissionSchema = z.object({
  id: z.string(),
  personalSongId: z.string(),
  sourceSongRevision: z.number(),
  version: z.number(),
  snapshot: submissionSnapshotSchema,
  suggestedClassification: suggestedClassificationSchema,
  video: z
    .object({
      provider: z.literal("youtube"),
      videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
      title: z.string().optional(),
      kind: z.enum(VIDEO_KINDS),
      ownPerformance: z.boolean(),
    })
    .nullable(),
  rights: z.object({
    status: z.enum(RIGHTS_STATUSES),
    license: z.object({ display: z.boolean(), reproduce: z.boolean(), redistribute: z.boolean() }),
    declarationVersion: z.string(),
    acceptedAt: iso,
    note: z.string().optional(),
  }),
  credit: z.object({ show: z.boolean(), name: z.string().optional() }),
  duplicateJustification: z.string().optional(),
  message: z.string().optional(),
  status,
  reviewNote: z.string().optional(),
  resultingCatalogSong: resulting.optional(),
  history: z.array(
    z.object({ action, actor: z.enum(["author", "admin"]), at: iso, version: z.number(), note: z.string().optional() }),
  ),
  previousVersions: z.array(
    z.object({ version: z.number(), snapshot: submissionSnapshotSchema, sourceSongRevision: z.number(), submittedAt: iso }),
  ),
  revision: z.number(),
  createdAt: iso,
  submittedAt: iso,
  reviewedAt: iso.nullable(),
  updatedAt: iso,
}) satisfies z.ZodType<MySubmission>;

const summarySchema = z.object({
  id: z.string(),
  personalSongId: z.string(),
  title: z.string(),
  artist: z.string(),
  status,
  version: z.number(),
  reviewNote: z.string().optional(),
  resultingCatalogSong: resulting.optional(),
  revision: z.number(),
  submittedAt: iso,
  updatedAt: iso,
}) satisfies z.ZodType<SubmissionSummary>;

const previewSchema = z.object({
  snapshot: submissionSnapshotSchema,
  sourceSongRevision: z.number(),
  duplicates: z.array(duplicate),
  activeSubmission: z.object({ id: z.string(), status }).nullable(),
  limits: z.object({
    maxPending: z.number(),
    pending: z.number(),
    maxPerDay: z.number(),
    today: z.number(),
    maxChordProLength: z.number(),
  }),
}) satisfies z.ZodType<SubmissionPreview>;

const adminSubmissionSchema = mySubmissionSchema.omit({ resultingCatalogSong: true }).extend({
  submittedBy: z.object({ id: z.string(), name: z.string(), email: z.string() }).nullable(),
  duplicates: z.array(duplicate),
  resultingCatalogSongId: z.string().nullable(),
  review: z
    .object({
      by: z.string(),
      at: iso,
      decision: z.enum(["approve", "reject", "request_changes", "withdraw", "resubmit"]),
      mode: z.enum(["new", "complement"]).optional(),
      note: z.string().optional(),
    })
    .nullable(),
}) satisfies z.ZodType<AdminSubmission>;

const adminSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  status,
  version: z.number(),
  submitterName: z.string().nullable(),
  hasContent: z.boolean(),
  hasVideo: z.boolean(),
  rightsStatus: z.enum(RIGHTS_STATUSES),
  submittedAt: iso,
  updatedAt: iso,
}) satisfies z.ZodType<AdminSubmissionSummary>;

const one = z.object({ submission: mySubmissionSchema });
const oneAdmin = z.object({ submission: adminSubmissionSchema });

/** Cliente do colaborador: mesma proteção de identidade (`x-repertorio-expected-user`) e de revisão. */
export function createSubmissionApi(userId: string, fetchImpl?: FetchLike) {
  const api = createLibraryApi({ userId, basePath: "/api/v1/catalog/submissions", ...(fetchImpl ? { fetchImpl } : {}) });
  const path = (id: string) => `/${encodeURIComponent(id)}`;

  return {
    preview: async (songId: string, signal?: AbortSignal) =>
      (await api.request(`/preview?songId=${encodeURIComponent(songId)}`, z.object({ preview: previewSchema }), { signal })).preview,
    create: async (request: SubmissionRequest) =>
      (await api.request("", one, { method: "POST", body: request })).submission,
    listMine: async (signal?: AbortSignal) =>
      (await api.request("/mine", z.object({ submissions: z.array(summarySchema) }), { signal })).submissions,
    get: async (id: string, signal?: AbortSignal) => (await api.request(path(id), one, { signal })).submission,
    withdraw: async (submission: Pick<MySubmission, "id" | "revision">) =>
      (await api.request(`${path(submission.id)}/withdraw`, one, { method: "POST", ifMatch: submission.revision })).submission,
    resubmit: async (submission: Pick<MySubmission, "id" | "revision">, request: ResubmissionRequest) =>
      (
        await api.request(`${path(submission.id)}/resubmit`, one, {
          method: "POST",
          body: request,
          ifMatch: submission.revision,
        })
      ).submission,
  };
}

export type SubmissionApi = ReturnType<typeof createSubmissionApi>;

/** Cliente da fila da administração. */
export function createSubmissionAdminApi(userId: string, fetchImpl?: FetchLike) {
  const api = createLibraryApi({ userId, basePath: "/api/v1/admin/catalog", ...(fetchImpl ? { fetchImpl } : {}) });
  const path = (id: string) => `/submissions/${encodeURIComponent(id)}`;

  return {
    list: async (filter?: (typeof SUBMISSION_STATUSES)[number], signal?: AbortSignal) =>
      (
        await api.request(filter ? `/submissions?status=${filter}` : "/submissions", z.object({ submissions: z.array(adminSummarySchema) }), {
          signal,
        })
      ).submissions,
    get: async (id: string, signal?: AbortSignal) => (await api.request(path(id), oneAdmin, { signal })).submission,
    approve: async (submission: Pick<AdminSubmission, "id" | "revision">, request: ApprovalRequest) =>
      api.request(`${path(submission.id)}/approve`, z.object({ submission: adminSubmissionSchema, catalogSong: catalogSongSchema }), {
        method: "POST",
        body: request,
        ifMatch: submission.revision,
      }),
    reject: async (submission: Pick<AdminSubmission, "id" | "revision">, note: string) =>
      (await api.request(`${path(submission.id)}/reject`, oneAdmin, { method: "POST", body: { note }, ifMatch: submission.revision }))
        .submission,
    requestChanges: async (submission: Pick<AdminSubmission, "id" | "revision">, note: string) =>
      (
        await api.request(`${path(submission.id)}/request-changes`, oneAdmin, {
          method: "POST",
          body: { note },
          ifMatch: submission.revision,
        })
      ).submission,
    /** Música do catálogo (destino de um complemento), para conferir a revisão atual. */
    getCatalogSong: async (id: string) =>
      (await api.request(`/songs/${encodeURIComponent(id)}`, z.object({ song: catalogSongSchema }))).song,
    removeFromCatalogSong: async (song: { id: string; revision: number }, removal: { video: boolean; credit: boolean }) =>
      (
        await api.request(`/songs/${encodeURIComponent(song.id)}/contribution-removal`, z.object({ song: catalogSongSchema }), {
          method: "POST",
          body: removal,
          ifMatch: song.revision,
        })
      ).song,
  };
}

export type SubmissionAdminApi = ReturnType<typeof createSubmissionAdminApi>;
