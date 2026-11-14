import { z } from "zod";

import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";

const moveSchema = z.strictObject({ direction: z.enum(["up", "down"]) });

export const POST = authenticatedRoute<{ id: string; itemId: string }>(
  async ({ request, params, library }) => {
    const expectedRevision = readExpectedRevision(request);
    const { direction } = await readJsonBody(request, moveSchema);
    const repertoire = await library.repertoires.moveItem(
      params.id,
      params.itemId,
      direction,
      expectedRevision,
    );
    return withETag(jsonResponse({ repertoire }), repertoire.revision);
  },
);
