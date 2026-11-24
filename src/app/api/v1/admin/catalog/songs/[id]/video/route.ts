import { catalogVideoUpdateSchema } from "@/features/catalog/domain/catalog-video";
import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";

export const PUT = adminRoute<{ id: string }>(async ({ request, params, catalog }) => {
  const revision = readExpectedRevision(request);
  const { video } = await readJsonBody(request, catalogVideoUpdateSchema);
  const song = await catalog.updateVideo(params.id, video, revision);
  return withETag(jsonResponse({ song }), song.revision);
});
