import { repertoireItemChangesSchema } from "@/features/repertoires/domain/repertoire-schema";
import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";

type Params = { id: string; itemId: string };

export const PATCH = authenticatedRoute<Params>(async ({ request, params, library }) => {
  const expectedRevision = readExpectedRevision(request);
  const changes = await readJsonBody(request, repertoireItemChangesSchema);
  const repertoire = await library.repertoires.updateItem(
    params.id,
    params.itemId,
    changes,
    expectedRevision,
  );
  return withETag(jsonResponse({ repertoire }), repertoire.revision);
});

export const DELETE = authenticatedRoute<Params>(async ({ request, params, library }) => {
  const repertoire = await library.repertoires.removeItem(
    params.id,
    params.itemId,
    readExpectedRevision(request),
  );
  return withETag(jsonResponse({ repertoire }), repertoire.revision);
});
