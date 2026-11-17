import { cn } from "cn";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormError } from "@/components/layout/form-error";
import { buttonVariants } from "@/components/ui/button";
import { lookupSession } from "@/server/auth/session";
import { isCatalogAdmin } from "@/server/catalog/catalog-service";

import { SignOutButton } from "./sign-out-button";

// Lê os cabeçalhos da requisição e nunca usa `use cache`: os dados são privados.
export async function AccountScreen() {
  const lookup = await lookupSession(await headers());

  if (lookup.status === "anonymous") {
    redirect("/entrar");
  }

  if (lookup.status === "unavailable") {
    return <FormError message="O serviço de contas está indisponível no momento." />;
  }

  const { user, expiresAt } = lookup.session;
  // O papel é lido do banco; nada no cliente o define.
  const isAdmin = await isCatalogAdmin(user.id).catch(() => false);

  return (
    <div className="max-w-md space-y-5">
      <dl className="space-y-3 rounded-xl border bg-card p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Nome</dt>
          <dd className="font-medium wrap-break-word">{user.name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">E-mail</dt>
          <dd className="font-medium wrap-break-word">{user.email}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sessão</dt>
          <dd className="font-medium">
            Ativa até{" "}
            <time dateTime={expiresAt.toISOString()}>
              {expiresAt.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
            </time>
          </dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        Suas músicas e repertórios ficam salvos nesta conta.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/compartilhamentos"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
        >
          Compartilhamentos
        </Link>
        <Link
          href="/conta/sugestoes"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
        >
          Minhas sugestões
        </Link>
        {isAdmin && (
          <Link
            href="/admin/catalogo"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
          >
            Administrar catálogo
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin/contribuicoes"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
          >
            Contribuições
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin/liturgia"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
          >
            Administrar liturgia
          </Link>
        )}
        <Link
          href="/conta/importar-biblioteca-antiga"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
        >
          Importar biblioteca antiga
        </Link>
      </div>
      <SignOutButton />
    </div>
  );
}
