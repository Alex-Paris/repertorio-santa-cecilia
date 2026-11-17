import { resubmissionRequestSchema } from "@/features/contributions/domain/submission";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";
import { submissionRoute } from "@/server/http/submission-route";

/** Nova versão após pedido de correções: o conteúdo é relido da biblioteca da própria conta. */
export const POST = submissionRoute<{ id: string }>(async ({ request, params, submissions }) => {
  const expectedRevision = readExpectedRevision(request);
  const input = await readJsonBody(request, resubmissionRequestSchema);
  const submission = await submissions.resubmit(params.id, expectedRevision, input);
  return withETag(jsonResponse({ submission }), submission.revision);
});
