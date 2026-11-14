import { updateShareSchema } from "@/features/sharing/domain/public-share";
import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";
import { readJsonBody } from "@/server/http/read-json-body";

type Params = { id: string; shareId: string };

export const PUT = authenticatedRoute<Params>(async ({ request, params, library }) => {
  const input = await readJsonBody(request, updateShareSchema);
  return jsonResponse({ share: await library.shares.update(params.id, params.shareId, input) });
});

export const DELETE = authenticatedRoute<Params>(async ({ params, library }) => {
  await library.shares.revoke(params.id, params.shareId);
  return new Response(null, { status: 204 });
});
