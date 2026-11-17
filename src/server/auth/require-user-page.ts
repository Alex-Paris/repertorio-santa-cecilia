import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { lookupSession } from "./session";

/** Páginas privadas: visitante vai para "Entrar"; serviço de contas fora do ar devolve `null`. */
export async function requireUserPage(): Promise<string | null> {
  const lookup = await lookupSession(await headers());
  if (lookup.status === "anonymous") {
    redirect("/entrar");
  }
  return lookup.status === "unavailable" ? null : lookup.session.user.id;
}
