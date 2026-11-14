import { z } from "zod";

import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { previewCatalogImport } from "@/server/catalog/catalog-import";

const bodySchema = z.strictObject({ document: z.unknown() });

/** Prévia da importação editorial: valida e aponta duplicatas, sem gravar. */
export const POST = adminRoute(async ({ request }) => {
  const { document } = await readJsonBody(request, bodySchema);
  return jsonResponse({ preview: await previewCatalogImport(document) });
});
