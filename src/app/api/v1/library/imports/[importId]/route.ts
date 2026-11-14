import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";

export const GET = authenticatedRoute<{ importId: string }>(async ({ params, library }) =>
  jsonResponse({ import: await library.imports.status(params.importId) }),
);
