import { entityIdSchema } from "@/features/songs/domain/song-schema";
import { LibraryError } from "@/features/library/domain/library-errors";
import { jsonResponse } from "@/server/http/api-error";
import { submissionRoute } from "@/server/http/submission-route";

/** Prévia do envio: o que vai na proposta, músicas semelhantes do catálogo publicado e limites. */
export const GET = submissionRoute(async ({ request, submissions }) => {
  const songId = entityIdSchema.safeParse(new URL(request.url).searchParams.get("songId"));
  if (!songId.success) {
    throw new LibraryError("song-not-found");
  }
  return jsonResponse({ preview: await submissions.preview(songId.data) });
});
