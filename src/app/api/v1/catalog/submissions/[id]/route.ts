import { jsonResponse } from "@/server/http/api-error";
import { withETag } from "@/server/http/revision";
import { submissionRoute } from "@/server/http/submission-route";

export const GET = submissionRoute<{ id: string }>(async ({ params, submissions }) => {
  const submission = await submissions.getMine(params.id);
  return withETag(jsonResponse({ submission }), submission.revision);
});
