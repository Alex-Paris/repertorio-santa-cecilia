import "server-only";

import { getConnectedAuth } from "./auth";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthenticatedSession {
  user: AuthenticatedUser;
  expiresAt: Date;
}

/** Valida a sessão no banco a partir dos cabeçalhos da requisição. */
export async function getSessionFromHeaders(
  headers: Headers,
): Promise<AuthenticatedSession | null> {
  // Sem cookie não há sessão a verificar, e o banco nem precisa estar disponível.
  if (!headers.has("cookie")) {
    return null;
  }

  const auth = await getConnectedAuth();
  const result = await auth.api.getSession({ headers });

  if (!result) {
    return null;
  }

  const { id, name, email } = result.user;
  return { user: { id, name, email }, expiresAt: new Date(result.session.expiresAt) };
}

export type SessionLookup =
  | { status: "authenticated"; session: AuthenticatedSession }
  | { status: "anonymous" }
  | { status: "unavailable" };

/** Para páginas: uma falha de banco vira um estado na tela, e não um erro de renderização. */
export async function lookupSession(headers: Headers): Promise<SessionLookup> {
  try {
    const session = await getSessionFromHeaders(headers);
    return session ? { status: "authenticated", session } : { status: "anonymous" };
  } catch (error) {
    console.error(`[auth] Sessão indisponível: ${error instanceof Error ? error.name : "erro"}.`);
    return { status: "unavailable" };
  }
}
