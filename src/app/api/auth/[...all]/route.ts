import { getConnectedAuth } from "@/server/auth/auth";
import { reportAuthFailure } from "@/server/auth/auth-diagnostics";
import { ApiError, toErrorResponse } from "@/server/http/api-error";

// Resolvida a cada requisição, para o build não depender de banco nem de variáveis de ambiente.
async function handleAuthRequest(request: Request): Promise<Response> {
  let phase: "prepare-auth" | "auth-handler" = "prepare-auth";
  try {
    const auth = await getConnectedAuth();
    phase = "auth-handler";
    return await auth.handler(request);
  } catch (error) {
    const requestId = reportAuthFailure(error, phase);
    return toErrorResponse(
      new ApiError(503, "persistence_failed", "O serviço está indisponível no momento.", { requestId }),
    );
  }
}

export const GET = handleAuthRequest;
export const POST = handleAuthRequest;
