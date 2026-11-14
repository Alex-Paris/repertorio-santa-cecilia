import { getConnectedAuth } from "@/server/auth/auth";
import { ApiError, toErrorResponse } from "@/server/http/api-error";

// Resolvida a cada requisição, para o build não depender de banco nem de variáveis de ambiente.
async function handleAuthRequest(request: Request): Promise<Response> {
  try {
    const auth = await getConnectedAuth();
    return await auth.handler(request);
  } catch {
    return toErrorResponse(
      new ApiError(503, "persistence_failed", "O serviço está indisponível no momento."),
    );
  }
}

export const GET = handleAuthRequest;
export const POST = handleAuthRequest;
