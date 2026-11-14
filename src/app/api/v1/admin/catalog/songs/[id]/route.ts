import { catalogSongInputSchema } from "@/features/catalog/domain/catalog-song";
import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";

type Params = { id: string };

export const GET = adminRoute<Params>(async ({ params, catalog }) => {
  const song = await catalog.get(params.id);
  return withETag(jsonResponse({ song }), song.revision);
});

export const PUT = adminRoute<Params>(async ({ request, params, catalog }) => {
  const expectedRevision = readExpectedRevision(request);
  const input = await readJsonBody(request, catalogSongInputSchema);
  const song = await catalog.update(params.id, input, expectedRevision);
  return withETag(jsonResponse({ song }), song.revision);
});
