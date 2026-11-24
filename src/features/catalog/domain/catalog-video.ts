import { z } from "zod";

import { parseYouTubeId } from "@/features/songs/domain/video-reference";

/** O cliente informa só o link e o título; a aprovação é registrada pelo servidor. */
export const catalogVideoInputSchema = z.strictObject({
  url: z.string().trim().max(2048).refine((url) => parseYouTubeId(url) !== null, "Informe um link HTTPS válido de um vídeo do YouTube."),
  title: z.string().trim().max(200, "O título do vídeo deve ter no máximo 200 caracteres.").optional(),
});

/** `null` remove o vídeo sem alterar cifra, classificação ou direitos. */
export const catalogVideoUpdateSchema = z.strictObject({ video: catalogVideoInputSchema.nullable() });

export type CatalogVideoInput = z.infer<typeof catalogVideoInputSchema>;
