import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { readExpectedRevision, withETag } from "@/server/http/revision";

export const POST = adminRoute<{ id: string }>(async ({ request, params, catalog }) => {
  const song = await catalog.publish(params.id, readExpectedRevision(request));
  return withETag(jsonResponse({ song }), song.revision);
});
