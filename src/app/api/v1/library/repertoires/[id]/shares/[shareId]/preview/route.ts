import { shareSelectionSchema } from "@/features/sharing/domain/public-share";
import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";
import { readJsonBody } from "@/server/http/read-json-body";

type Params = { id: string; shareId: string };

/** Só calcula: a publicação continua como está. */
export const POST = authenticatedRoute<Params>(async ({ request, params, library }) => {
  const selection = await readJsonBody(request, shareSelectionSchema);
  return jsonResponse({
    preview: await library.shares.previewUpdate(params.id, params.shareId, selection),
  });
});
