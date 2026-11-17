import "server-only";

import { createSubmissionAdminService, type SubmissionAdminService } from "@/server/contributions/submission-admin-service";
import { createSubmissionService, type SubmissionService } from "@/server/contributions/submission-service";

import { adminRoute } from "./admin-route";
import { authenticatedRoute, type AuthenticatedRequest } from "./authenticated-route";

/** Contribuições do colaborador: a conta vem sempre da sessão validada no servidor. */
export function submissionRoute<Params = object>(
  handler: (context: AuthenticatedRequest<Params> & { submissions: SubmissionService }) => Promise<Response>,
) {
  return authenticatedRoute<Params>((context) => handler({ ...context, submissions: createSubmissionService(context.userId) }));
}

/** Fila da administração: o papel é conferido no banco a cada requisição. */
export function submissionAdminRoute<Params = object>(
  handler: (context: AuthenticatedRequest<Params> & { review: SubmissionAdminService }) => Promise<Response>,
) {
  return adminRoute<Params>((context) => handler({ ...context, review: createSubmissionAdminService(context.userId) }));
}
