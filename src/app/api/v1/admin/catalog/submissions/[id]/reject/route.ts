import { decisionNoteSchema } from "@/features/contributions/domain/submission";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";
import { submissionAdminRoute } from "@/server/http/submission-route";

export const POST = submissionAdminRoute<{ id: string }>(async ({ request, params, review }) => {
  const expectedRevision = readExpectedRevision(request);
  const input = await readJsonBody(request, decisionNoteSchema);
  const submission = await review.reject(params.id, expectedRevision, input);
  return withETag(jsonResponse({ submission }), submission.revision);
});
