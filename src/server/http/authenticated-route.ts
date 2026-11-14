import "server-only";

import { unstable_rethrow } from "next/navigation";

import { EXPECTED_USER_HEADER } from "@/features/library/data/remote/library-api";
import { getSessionFromHeaders, type AuthenticatedSession } from "@/server/auth/session";
import { getServerEnv } from "@/server/env";
import { createLibraryService, type LibraryService } from "@/server/library/library-service";

import { ApiError, markPrivate, toErrorResponse } from "./api-error";

interface RouteContext<Params> {
  params: Promise<Params>;
}

export interface AuthenticatedRequest<Params> {
  request: Request;
  params: Params;
  library: LibraryService;
  /** Sempre da sessão validada no servidor. */
  userId: string;
}

const SAFE_METHODS = new Set(["GET", "HEAD"]);

/**
 * O Better Auth só protege as próprias rotas. Aqui, os cookies `SameSite=Lax` e a
 * exigência de JSON são complementados pela mesma regra de origem confiável.
 */
function assertTrustedOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (
    !SAFE_METHODS.has(request.method) &&
    origin !== null &&
    origin !== new URL(getServerEnv().BETTER_AUTH_URL).origin
  ) {
    throw new ApiError(403, "forbidden", "Origem não autorizada.");
  }
}

/**
 * Se outra aba trocou de conta, o cookie já é de outro usuário. A autorização continuaria
 * correta, mas a escrita iria para a biblioteca errada; por isso a requisição é recusada.
 */
function assertExpectedUser(request: Request, session: AuthenticatedSession): void {
  const expected = request.headers.get(EXPECTED_USER_HEADER);
  if (expected !== null && expected !== session.user.id) {
    throw new ApiError(409, "session_changed", "A conta deste navegador mudou.");
  }
}

async function requireSession(request: Request): Promise<AuthenticatedSession> {
  let session: AuthenticatedSession | null;

  try {
    session = await getSessionFromHeaders(request.headers);
  } catch {
    throw new ApiError(503, "persistence_failed", "O serviço está indisponível no momento.");
  }

  if (!session) {
    throw new ApiError(401, "unauthenticated", "Entre na sua conta para continuar.");
  }
  return session;
}

/** Adaptador fino: autentica, restringe a biblioteca ao usuário da sessão e padroniza erros. */
export function authenticatedRoute<Params = object>(
  handler: (context: AuthenticatedRequest<Params>) => Promise<Response>,
) {
  return async (request: Request, { params }: RouteContext<Params>): Promise<Response> => {
    try {
      assertTrustedOrigin(request);
      const session = await requireSession(request);
      assertExpectedUser(request, session);

      return markPrivate(
        await handler({
          request,
          params: await params,
          library: createLibraryService(session.user.id),
          userId: session.user.id,
        }),
      );
    } catch (error) {
      // Rotas só com GET são pré-renderizadas no build; o Next interrompe isso com um erro próprio.
      unstable_rethrow(error);
      return toErrorResponse(error);
    }
  };
}
