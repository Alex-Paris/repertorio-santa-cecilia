import { jsonResponse } from "@/server/http/api-error";
import { readExpectedRevision, withETag } from "@/server/http/revision";
import { submissionRoute } from "@/server/http/submission-route";

export const POST = submissionRoute<{ id: string }>(async ({ request, params, submissions }) => {
  const submission = await submissions.withdraw(params.id, readExpectedRevision(request));
  return withETag(jsonResponse({ submission }), submission.revision);
});
