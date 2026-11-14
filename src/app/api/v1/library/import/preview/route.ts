import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";
import { readJsonBody } from "@/server/http/read-json-body";
import {
  importPreviewRequestSchema,
  MAX_IMPORT_BODY_BYTES,
} from "@/server/library/import/import-validation";

export const POST = authenticatedRoute(async ({ request, library }) => {
  const body = await readJsonBody(request, importPreviewRequestSchema, MAX_IMPORT_BODY_BYTES);
  return jsonResponse({ preview: await library.imports.preview(body) });
});
