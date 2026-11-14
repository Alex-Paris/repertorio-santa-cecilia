import { z } from "zod";

import { CATALOG_STATUSES, catalogSongInputSchema } from "@/features/catalog/domain/catalog-song";
import { LibraryError } from "@/features/library/domain/library-errors";
import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { withETag } from "@/server/http/revision";

const listSchema = z.strictObject({ status: z.enum(CATALOG_STATUSES).optional() });

/** Todas as músicas, inclusive rascunhos: somente para a administração. */
export const GET = adminRoute(async ({ request, catalog }) => {
  const result = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!result.success) {
    throw new LibraryError("invalid-data");
  }
  return jsonResponse({ songs: await catalog.list(result.data.status) });
});

/** Toda música nova começa como rascunho. */
export const POST = adminRoute(async ({ request, catalog }) => {
  const input = await readJsonBody(request, catalogSongInputSchema);
  const song = await catalog.create(input);
  return withETag(jsonResponse({ song }, 201), song.revision);
});
