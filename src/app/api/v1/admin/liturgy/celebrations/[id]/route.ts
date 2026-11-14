import { z } from "zod";

import type { CelebrationInput } from "@/features/liturgy/domain/celebration-record";
import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";
import { createLiturgyAdminService } from "@/server/liturgy/celebration-store";

type Params = { id: string };

const bodySchema = z.strictObject({ celebration: z.unknown() });

export const GET = adminRoute<Params>(async ({ params, userId }) => {
  const celebration = await createLiturgyAdminService(userId).get(params.id);
  return withETag(jsonResponse({ celebration }), celebration.revision);
});

/** Editar conteúdo revisado devolve a celebração à revisão: a aprovação não é mantida. */
export const PUT = adminRoute<Params>(async ({ request, params, userId }) => {
  const expectedRevision = readExpectedRevision(request);
  const { celebration: input } = await readJsonBody(request, bodySchema);
  const celebration = await createLiturgyAdminService(userId).update(params.id, input as CelebrationInput, expectedRevision);
  return withETag(jsonResponse({ celebration }), celebration.revision);
});
