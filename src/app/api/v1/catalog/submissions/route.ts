import { submissionRequestSchema } from "@/features/contributions/domain/submission";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { withETag } from "@/server/http/revision";
import { submissionRoute } from "@/server/http/submission-route";

/** Envia uma música da própria biblioteca como sugestão. Nada é publicado aqui. */
export const POST = submissionRoute(async ({ request, submissions }) => {
  const input = await readJsonBody(request, submissionRequestSchema);
  const { submission, created } = await submissions.create(input);
  return withETag(jsonResponse({ submission }, created ? 201 : 200), submission.revision);
});
