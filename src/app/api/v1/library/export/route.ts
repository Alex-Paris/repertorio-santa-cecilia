import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";

export const GET = authenticatedRoute(async ({ library }) =>
  jsonResponse({ backup: await library.exportBackup() }),
);
