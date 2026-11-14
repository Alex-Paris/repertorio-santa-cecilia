import { z } from "zod";

import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";

// O conteúdo é validado pelo serviço, com as regras do domínio; `null` remove a classificação.
const bodySchema = z.strictObject({ liturgy: z.unknown() });

export const PUT = adminRoute<{ id: string }>(async ({ request, params, catalog }) => {
  const expectedRevision = readExpectedRevision(request);
  const { liturgy } = await readJsonBody(request, bodySchema);
  const song = await catalog.classify(params.id, (liturgy ?? null) as never, expectedRevision);
  return withETag(jsonResponse({ song }), song.revision);
});
