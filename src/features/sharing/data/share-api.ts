import { z } from "zod";

import { createLibraryApi } from "@/features/library/data/remote/library-api";

import {
  sharePreviewSchema,
  shareSummarySchema,
  type PublishShareInput,
  type SharePreview,
  type ShareSelection,
  type ShareSummary,
  type UpdateShareInput,
} from "../domain/public-share";

const listResponse = z.object({ enabled: z.boolean(), shares: z.array(shareSummarySchema) });
const shareResponse = z.object({ share: shareSummarySchema });
const previewResponse = z.object({ preview: sharePreviewSchema });

export type ShareList = z.infer<typeof listResponse>;

export interface ShareApi {
  listAll(): Promise<ShareList>;
  list(repertoireId: string): Promise<ShareList>;
  preview(repertoireId: string, shareId: string | null, selection: ShareSelection): Promise<SharePreview>;
  create(repertoireId: string, input: PublishShareInput): Promise<ShareSummary>;
  update(repertoireId: string, shareId: string, input: UpdateShareInput): Promise<ShareSummary>;
  revoke(repertoireId: string, shareId: string): Promise<void>;
}

/** Vinculada à conta em tela: se a sessão for de outra, o servidor recusa. */
export function createShareApi(userId: string): ShareApi {
  const api = createLibraryApi({ userId });

  function base(repertoireId: string): string {
    return `/repertoires/${encodeURIComponent(repertoireId)}/shares`;
  }

  function item(repertoireId: string, shareId: string): string {
    return `${base(repertoireId)}/${encodeURIComponent(shareId)}`;
  }

  return {
    listAll: () => api.request("/shares", listResponse),
    list: (repertoireId) => api.request(base(repertoireId), listResponse),

    async preview(repertoireId, shareId, selection) {
      const path = shareId ? `${item(repertoireId, shareId)}/preview` : `${base(repertoireId)}/preview`;
      return (await api.request(path, previewResponse, { method: "POST", body: selection })).preview;
    },

    async create(repertoireId, input) {
      return (await api.request(base(repertoireId), shareResponse, { method: "POST", body: input })).share;
    },

    async update(repertoireId, shareId, input) {
      return (await api.request(item(repertoireId, shareId), shareResponse, { method: "PUT", body: input }))
        .share;
    },

    revoke: (repertoireId, shareId) => api.send(item(repertoireId, shareId), { method: "DELETE" }),
  };
}
