import { publishShareSchema } from "@/features/sharing/domain/public-share";
import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";
import { readJsonBody } from "@/server/http/read-json-body";

type Params = { id: string };

export const GET = authenticatedRoute<Params>(async ({ params, library }) =>
  jsonResponse({
    enabled: library.shares.isEnabled(),
    shares: await library.shares.listForRepertoire(params.id),
  }),
);

export const POST = authenticatedRoute<Params>(async ({ request, params, library }) => {
  const input = await readJsonBody(request, publishShareSchema);
  return jsonResponse({ share: await library.shares.create(params.id, input) }, 201);
});
