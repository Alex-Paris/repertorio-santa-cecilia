import { LibraryError } from "@/features/library/domain/library-errors";
import { songInputSchema } from "@/features/songs/domain/song-schema";
import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";

type Params = { id: string };

export const GET = authenticatedRoute<Params>(async ({ params, library }) => {
  const song = await library.songs.findById(params.id);
  if (!song) {
    throw new LibraryError("song-not-found");
  }
  return withETag(jsonResponse({ song }), song.revision);
});

export const PUT = authenticatedRoute<Params>(async ({ request, params, library }) => {
  const expectedRevision = readExpectedRevision(request);
  const input = await readJsonBody(request, songInputSchema);
  const song = await library.songs.update(params.id, input, expectedRevision);
  return withETag(jsonResponse({ song }), song.revision);
});

export const DELETE = authenticatedRoute<Params>(async ({ request, params, library }) => {
  await library.songs.delete(params.id, readExpectedRevision(request));
  return new Response(null, { status: 204 });
});
