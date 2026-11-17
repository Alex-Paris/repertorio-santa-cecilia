import { jsonResponse } from "@/server/http/api-error";
import { withETag } from "@/server/http/revision";
import { submissionAdminRoute } from "@/server/http/submission-route";

export const GET = submissionAdminRoute<{ id: string }>(async ({ params, review }) => {
  const submission = await review.get(params.id);
  return withETag(jsonResponse({ submission }), submission.revision);
});
