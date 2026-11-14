import { LibraryError } from "@/features/library/domain/library-errors";
import { repertoireInputSchema } from "@/features/repertoires/domain/repertoire-schema";
import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";

type Params = { id: string };

export const GET = authenticatedRoute<Params>(async ({ params, library }) => {
  const repertoire = await library.repertoires.findById(params.id);
  if (!repertoire) {
    throw new LibraryError("repertoire-not-found");
  }
  return withETag(jsonResponse({ repertoire }), repertoire.revision);
});

export const PUT = authenticatedRoute<Params>(async ({ request, params, library }) => {
  const expectedRevision = readExpectedRevision(request);
  const input = await readJsonBody(request, repertoireInputSchema);
  const repertoire = await library.repertoires.update(params.id, input, expectedRevision);
  return withETag(jsonResponse({ repertoire }), repertoire.revision);
});

export const DELETE = authenticatedRoute<Params>(async ({ request, params, library }) => {
  await library.repertoires.delete(params.id, readExpectedRevision(request));
  return new Response(null, { status: 204 });
});
