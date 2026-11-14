import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";
import { readJsonBody } from "@/server/http/read-json-body";
import {
  importRequestSchema,
  MAX_IMPORT_BODY_BYTES,
} from "@/server/library/import/import-validation";

export const POST = authenticatedRoute(async ({ request, library }) => {
  const body = await readJsonBody(request, importRequestSchema, MAX_IMPORT_BODY_BYTES);
  const { summary, replayed } = await library.imports.execute(body);

  return jsonResponse({ import: { ...summary, status: "completed", replayed } }, replayed ? 200 : 201);
});
