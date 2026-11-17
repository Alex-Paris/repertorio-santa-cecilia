import { approvalRequestSchema } from "@/features/contributions/domain/submission";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";
import { submissionAdminRoute } from "@/server/http/submission-route";

/** Aprova como música nova ou como complemento de uma existente, numa única transação. */
export const POST = submissionAdminRoute<{ id: string }>(async ({ request, params, review }) => {
  const expectedRevision = readExpectedRevision(request);
  const input = await readJsonBody(request, approvalRequestSchema);
  const result = await review.approve(params.id, expectedRevision, input);
  return withETag(jsonResponse(result), result.submission.revision);
});
