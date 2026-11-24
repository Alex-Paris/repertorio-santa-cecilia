import { cloneShareRequestSchema } from "@/features/sharing/domain/clone-share";
import { authenticatedRoute } from "@/server/http/authenticated-route";
import { jsonResponse } from "@/server/http/api-error";
import { assertWithinRateLimit } from "@/server/http/rate-limit";
import { readJsonBody } from "@/server/http/read-json-body";
import { clonePublicShare } from "@/server/sharing/clone-share";

export const POST = authenticatedRoute(async ({ request, userId }) => {
  assertWithinRateLimit(request, `share-clone:${userId}`, 10);
  const input = await readJsonBody(request, cloneShareRequestSchema);
  return jsonResponse(await clonePublicShare(userId, input), 201);
});
