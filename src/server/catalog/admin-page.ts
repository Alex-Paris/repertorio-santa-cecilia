import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { lookupSession } from "@/server/auth/session";

import { isCatalogAdmin } from "./catalog-service";

/**
 * Proteção das páginas da administração, no servidor. Para quem não é administrador, a área
 * simplesmente não existe (404); as rotas de API conferem o papel de novo em cada operação.
 */
export async function requireCatalogAdminPage(): Promise<string> {
  const lookup = await lookupSession(await headers());

  if (lookup.status === "anonymous") {
    redirect("/entrar");
  }
  if (lookup.status === "unavailable" || !(await isCatalogAdmin(lookup.session.user.id).catch(() => false))) {
    notFound();
  }
  return lookup.session.user.id;
}
