import { z } from "zod";

import { celebrationQuerySchema } from "@/features/liturgy/domain/celebration-query";
import type { CelebrationInput } from "@/features/liturgy/domain/celebration-record";
import { LibraryError } from "@/features/library/domain/library-errors";
import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { withETag } from "@/server/http/revision";
import { createLiturgyAdminService } from "@/server/liturgy/celebration-store";

/** O conteúdo é validado pelo serviço, com as regras do domínio. */
const bodySchema = z.strictObject({ celebration: z.unknown() });

export const GET = adminRoute(async ({ request, userId }) => {
  const query = celebrationQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) {
    throw new LibraryError("invalid-data", query.error.issues[0]?.message);
  }
  return jsonResponse(await createLiturgyAdminService(userId).list(query.data));
});

export const POST = adminRoute(async ({ request, userId }) => {
  const { celebration: input } = await readJsonBody(request, bodySchema);
  const celebration = await createLiturgyAdminService(userId).create(input as CelebrationInput);
  return withETag(jsonResponse({ celebration }, 201), celebration.revision);
});
