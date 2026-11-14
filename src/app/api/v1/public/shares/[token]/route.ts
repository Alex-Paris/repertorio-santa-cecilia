import { unstable_rethrow } from "next/navigation";

import { readPublicShare } from "@/server/sharing/public-share-reader";
import { PUBLIC_SHARE_HEADERS } from "@/server/http/public-share-headers";

function respond(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...PUBLIC_SHARE_HEADERS },
  });
}

const NOT_AVAILABLE = { error: { code: "not_found", message: "Este link não está disponível." } };

/** Somente leitura e sem sessão. Inválido, revogado e inexistente têm a mesma resposta. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  try {
    const { token } = await params;
    const share = await readPublicShare(token);
    return share ? respond({ share }, 200) : respond(NOT_AVAILABLE, 404);
  } catch (error) {
    unstable_rethrow(error);
    return respond(
      { error: { code: "persistence_failed", message: "O serviço está indisponível no momento." } },
      503,
    );
  }
}
