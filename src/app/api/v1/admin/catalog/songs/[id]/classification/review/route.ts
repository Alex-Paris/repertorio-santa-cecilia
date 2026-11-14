import { z } from "zod";

import type { ClassificationReviewRequest } from "@/features/liturgy/domain/classification";
import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";

/** Conferir a classificação (com a fonte consultada), registrar divergência ou resolvê-la. */
const bodySchema = z.record(z.string(), z.unknown());

export const POST = adminRoute<{ id: string }>(async ({ request, params, catalog }) => {
  const expectedRevision = readExpectedRevision(request);
  const body = await readJsonBody(request, bodySchema);
  const song = await catalog.reviewClassification(params.id, body as ClassificationReviewRequest, expectedRevision);
  return withETag(jsonResponse({ song }), song.revision);
});
