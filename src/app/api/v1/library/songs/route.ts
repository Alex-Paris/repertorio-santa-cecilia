import { songInputSchema } from "@/features/songs/domain/song-schema";
import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";
import { readJsonBody } from "@/server/http/read-json-body";
import { withETag } from "@/server/http/revision";

export const GET = authenticatedRoute(async ({ library }) =>
  jsonResponse({ songs: await library.songs.list() }),
);

export const POST = authenticatedRoute(async ({ request, library }) => {
  const input = await readJsonBody(request, songInputSchema);
  const song = await library.songs.create(input);
  return withETag(jsonResponse({ song }, 201), song.revision);
});
