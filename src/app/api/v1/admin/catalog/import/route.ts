import { z } from "zod";

import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { commitCatalogImport } from "@/server/catalog/catalog-import";

/** Exige confirmação explícita; cria só rascunhos e nunca altera músicas existentes. */
const bodySchema = z.strictObject({
  document: z.unknown(),
  confirm: z.literal(true, { error: "Confirme a importação depois de conferir a prévia." }),
});

export const POST = adminRoute(async ({ request, userId }) => {
  const { document } = await readJsonBody(request, bodySchema);
  return jsonResponse({ result: await commitCatalogImport(document, userId) }, 201);
});
