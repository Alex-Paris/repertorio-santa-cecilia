import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { readExpectedRevision, withETag } from "@/server/http/revision";

/** Retira do catálogo sem apagar: repertórios mantêm a referência e mostram indisponível. */
export const POST = adminRoute<{ id: string }>(async ({ request, params, catalog }) => {
  const song = await catalog.unpublish(params.id, readExpectedRevision(request));
  return withETag(jsonResponse({ song }), song.revision);
});
