import "server-only";

import { unstable_rethrow } from "next/navigation";

import { toErrorResponse } from "./api-error";
import { assertWithinRateLimit } from "./rate-limit";

const REQUESTS_PER_MINUTE = 120;

/**
 * Leitura pública do catálogo: sem sessão e só com dados publicados. `no-store` faz uma
 * despublicação valer na próxima requisição.
 */
export function publicCatalogRoute<Params = object>(
  handler: (context: { request: Request; params: Params }) => Promise<unknown>,
) {
  return async (request: Request, { params }: { params: Promise<Params> }): Promise<Response> => {
    try {
      assertWithinRateLimit(request, "catalogo", REQUESTS_PER_MINUTE);
      const body = await handler({ request, params: await params });
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    } catch (error) {
      unstable_rethrow(error);
      const response = toErrorResponse(error);
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
  };
}
