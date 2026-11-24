import { z } from "zod";

import { MAX_VIDEO_START_SECONDS, parseYouTubeId, type YouTubeReference } from "@/features/songs/domain/video-reference";

export const videoStartSecondsSchema = z.number().int("Use um número inteiro de segundos.").min(0, "O tempo inicial não pode ser negativo.").max(MAX_VIDEO_START_SECONDS, "O tempo inicial deve ser de até 604800 segundos.");

export const publicVideoReferenceSchema: z.ZodType<YouTubeReference> = z.strictObject({
  provider: z.literal("youtube"),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: z.string().max(200).optional(),
  startSeconds: videoStartSecondsSchema.optional(),
});

/** O cliente informa a referência e o início; a aprovação é registrada pelo servidor. */
export const catalogVideoInputSchema = z.strictObject({
  url: z.string().trim().max(2048).refine((url) => parseYouTubeId(url) !== null, "Informe um link HTTPS válido de um vídeo do YouTube."),
  title: z.string().trim().max(200, "O título do vídeo deve ter no máximo 200 caracteres.").optional(),
  startSeconds: videoStartSecondsSchema.optional(),
});

export type CatalogVideoInput = z.infer<typeof catalogVideoInputSchema>;
