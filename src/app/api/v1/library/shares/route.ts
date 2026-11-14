import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";

export const GET = authenticatedRoute(async ({ library }) =>
  jsonResponse({ enabled: library.shares.isEnabled(), shares: await library.shares.listAll() }),
);
