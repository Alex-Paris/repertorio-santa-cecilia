import { z } from "zod";

import type { ReviewRequest } from "@/features/liturgy/domain/review";
import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";
import { createLiturgyAdminService } from "@/server/liturgy/celebration-store";

/** Aprovar, registrar ou resolver divergência e reabrir. A ação é validada pelo serviço. */
const bodySchema = z.record(z.string(), z.unknown());

export const POST = adminRoute<{ id: string }>(async ({ request, params, userId }) => {
  const expectedRevision = readExpectedRevision(request);
  const body = await readJsonBody(request, bodySchema);
  const celebration = await createLiturgyAdminService(userId).review(params.id, body as ReviewRequest, expectedRevision);
  return withETag(jsonResponse({ celebration }), celebration.revision);
});
