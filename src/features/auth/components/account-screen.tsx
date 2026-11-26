import {
  BookOpenCheck,
  ChevronRight,
  Inbox,
  Library,
  Link2,
  ListMusic,
  Send,
  ShieldCheck,
  Upload,
  CalendarCog,
  type LucideIcon,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { FormError } from "@/components/layout/form-error";
import { lookupSession } from "@/server/auth/session";
import { isCatalogAdmin } from "@/server/catalog/catalog-service";

import { SignOutButton } from "./sign-out-button";

interface AccountLink {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

/** Bloco da página: título em serifa, uma linha de apoio e o conteúdo num cartão marfim. */
function AccountSection({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col rounded-2xl border bg-card p-4 shadow-sm md:p-5">
      <h2 id={id} className="text-xl font-semibold text-heading">
        {title}
      </h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-3 flex-1">{children}</div>
    </section>
  );
}

/** Ações relacionadas em linhas: ícone, nome e o que se faz ali. */
function LinkList({ links }: { links: AccountLink[] }) {
  return (
    <ul className="-mx-2 divide-y divide-border/70">
      {links.map(({ href, label, description, icon: Icon }) => (
        <li key={href}>
          <Link
            href={href}
            className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
          >
            <Icon className="size-4.5 shrink-0 text-gold-strong" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{label}</span>
              <span className="block text-sm text-muted-foreground">{description}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

const LIBRARY_LINKS: AccountLink[] = [
  { href: "/biblioteca", label: "Minhas músicas", description: "Cifras particulares, só suas.", icon: Library },
  { href: "/repertorios", label: "Repertórios", description: "Listas para missas e encontros.", icon: ListMusic },
  { href: "/compartilhamentos", label: "Compartilhamentos", description: "Links públicos ativos dos seus repertórios.", icon: Link2 },
  {
    href: "/conta/importar-biblioteca-antiga",
    label: "Importar biblioteca antiga",
    description: "Recuperar músicas guardadas neste navegador.",
    icon: Upload,
  },
];

const CONTRIBUTION_LINKS: AccountLink[] = [
  {
    href: "/conta/sugestoes",
    label: "Minhas sugestões",
    description: "Músicas que você sugeriu para o catálogo e a situação de cada uma.",
    icon: Send,
  },
];

const ADMIN_LINKS: AccountLink[] = [
  { href: "/admin/catalogo", label: "Administrar catálogo", description: "Músicas globais, direitos e publicação.", icon: BookOpenCheck },
  { href: "/admin/contribuicoes", label: "Contribuições", description: "Fila de sugestões para revisar.", icon: Inbox },
  { href: "/admin/liturgia", label: "Administrar liturgia", description: "Celebrações, leituras e revisão editorial.", icon: CalendarCog },
];

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
  const isAdmin = await isCatalogAdmin(user.id).catch(() => false);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="flex items-center gap-4 rounded-2xl border bg-card p-5" aria-label="Seu perfil">
        <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-secondary text-xl font-semibold text-primary">{user.name.trim().slice(0,1).toUpperCase()}</span>
        <div className="min-w-0"><h2 className="text-lg font-semibold wrap-break-word">{user.name}</h2><p className="text-sm text-muted-foreground wrap-break-word">{user.email}</p></div>
      </section>
      <AccountSection id="secao-biblioteca" title="Biblioteca e repertórios">
        <LinkList links={LIBRARY_LINKS} />
      </AccountSection>

      <AccountSection id="secao-contribuicoes" title="Contribuições" description="Sugestões para o catálogo central, revisadas pela equipe.">
        <LinkList links={CONTRIBUTION_LINKS} />
      </AccountSection>

      {/* O papel é lido do banco; nada no cliente o define. */}
      {isAdmin && (
        <AccountSection id="secao-administracao" title="Administração" description="Visível só para quem tem o papel de administração.">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold-strong">
            <ShieldCheck className="size-3.5" aria-hidden />
            Administração do catálogo
          </div>
          <LinkList links={ADMIN_LINKS} />
        </AccountSection>
      )}      <details className="rounded-2xl border bg-card p-5">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Sessão e acesso à conta</summary>
        <p className="mt-3 text-sm text-muted-foreground">Sessão ativa até <time dateTime={expiresAt.toISOString()}>{expiresAt.toLocaleDateString("pt-BR", {timeZone:"UTC"})}</time>.</p>
        <div className="mt-4"><SignOutButton /></div>
      </details>
    </div>
  );
}
