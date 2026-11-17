import { contributionRemovalSchema } from "@/server/contributions/submission-admin-service";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";
import { submissionAdminRoute } from "@/server/http/submission-route";

/** Retirada do vídeo e/ou do crédito público de uma música (pedido do titular, contestação). */
export const POST = submissionAdminRoute<{ id: string }>(async ({ request, params, review }) => {
  const expectedRevision = readExpectedRevision(request);
  const input = await readJsonBody(request, contributionRemovalSchema);
  const song = await review.removeFromCatalogSong(params.id, expectedRevision, input);
  return withETag(jsonResponse({ song }), song.revision);
});
