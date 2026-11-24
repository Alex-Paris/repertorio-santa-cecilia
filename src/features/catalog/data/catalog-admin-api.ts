import { z } from "zod";

import { createLibraryApi } from "@/features/library/data/remote/library-api";
import type { ClassificationReviewRequest, SongClassificationInput } from "@/features/liturgy/domain/classification";
import type { CatalogVideoInput } from "../domain/catalog-video";

import {
  catalogSongSchema,
  type CatalogSong,
  type CatalogSongInput,
  type CatalogStatus,
} from "../domain/catalog-song";

const songResponse = z.object({ song: catalogSongSchema });
const listResponse = z.object({ songs: z.array(catalogSongSchema) });

/** Cliente da administração: mesma proteção de identidade e de revisão da biblioteca. */
export function createCatalogAdminApi(userId: string) {
  const api = createLibraryApi({ userId, basePath: "/api/v1/admin/catalog" });
  const path = (id: string) => `/songs/${encodeURIComponent(id)}`;

  return {
    list: async (status?: CatalogStatus) =>
      (await api.request(status ? `/songs?status=${status}` : "/songs", listResponse)).songs,
    get: async (id: string) => (await api.request(path(id), songResponse)).song,
    create: async (input: CatalogSongInput) =>
      (await api.request("/songs", songResponse, { method: "POST", body: input })).song,
    update: async (id: string, input: CatalogSongInput, revision: number) =>
      (await api.request(path(id), songResponse, { method: "PUT", body: input, ifMatch: revision })).song,
    updateVideo: async (id: string, video: CatalogVideoInput | null, revision: number) =>
      (await api.request(`${path(id)}/video`, songResponse, { method: "PUT", body: { video }, ifMatch: revision })).song,
    publish: async (song: CatalogSong) =>
      (await api.request(`${path(song.id)}/publish`, songResponse, { method: "POST", ifMatch: song.revision })).song,
    unpublish: async (song: CatalogSong) =>
      (await api.request(`${path(song.id)}/unpublish`, songResponse, { method: "POST", ifMatch: song.revision })).song,
    /** `null` remove a classificação. Só o campo litúrgico muda no servidor. */
    classify: async (song: CatalogSong, liturgy: SongClassificationInput | null) =>
      (
        await api.request(`${path(song.id)}/classification`, songResponse, {
          method: "PUT",
          body: { liturgy },
          ifMatch: song.revision,
        })
      ).song,
    /** Conferir a classificação (com a fonte consultada), registrar ou resolver divergência. */
    reviewClassification: async (song: CatalogSong, request: ClassificationReviewRequest) =>
      (
        await api.request(`${path(song.id)}/classification/review`, songResponse, {
          method: "POST",
          body: request,
          ifMatch: song.revision,
        })
      ).song,
    previewImport: async (document: unknown) =>
      (await api.request("/import/preview", z.object({ preview: importPreviewSchema }), { method: "POST", body: { document } })).preview,
    commitImport: async (document: unknown) =>
      (
        await api.request("/import", z.object({ result: importResultSchema }), {
          method: "POST",
          body: { document, confirm: true },
        })
      ).result,
  };
}

const importEntrySchema = z.object({
  index: z.number(),
  importKey: z.string().nullable(),
  title: z.string(),
  artist: z.string(),
  status: z.enum(["new", "existing", "duplicate", "invalid"]),
  reason: z.string().optional(),
  sources: z.array(z.object({ title: z.string(), url: z.string().optional(), accessedAt: z.string().optional() })),
  existing: z.object({ id: z.string(), title: z.string(), artist: z.string() }).optional(),
  record: z.unknown().optional(),
  classification: z.unknown().optional(),
});

const importPreviewSchema = z.object({
  entries: z.array(importEntrySchema),
  counts: z.object({ new: z.number(), existing: z.number(), duplicate: z.number(), invalid: z.number() }),
});

const importResultSchema = importPreviewSchema.extend({
  created: z.array(z.object({ id: z.string(), importKey: z.string(), title: z.string() })),
});

export type ImportPreviewResponse = z.infer<typeof importPreviewSchema>;
export type ImportResultResponse = z.infer<typeof importResultSchema>;

export type CatalogAdminApi = ReturnType<typeof createCatalogAdminApi>;
