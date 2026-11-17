import { LibraryError } from "@/features/library/domain/library-errors";
import { jsonResponse } from "@/server/http/api-error";
import { isSubmissionStatus } from "@/server/contributions/submission-admin-service";
import { submissionAdminRoute } from "@/server/http/submission-route";

export const GET = submissionAdminRoute(async ({ request, review }) => {
  const status = new URL(request.url).searchParams.get("status");
  if (status !== null && !isSubmissionStatus(status)) {
    throw new LibraryError("invalid-data", "Situação inválida.");
  }
  return jsonResponse({ submissions: await review.list(status ?? undefined) });
});
