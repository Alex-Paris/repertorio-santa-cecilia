"use client";

import { cn } from "cn";
import { BookOpen, Church, House, Layers, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

interface NavItem {
  href: string;
  label: string;
  /** Rótulo da barra inferior, onde cinco itens dividem a largura do celular. */
  shortLabel: string;
  /** Só na barra inferior do celular; no computador, a entrada fica no menu "Conta". */
  mobileOnly?: boolean;
  icon: LucideIcon;
  /** Prefixos de rota em que este item aparece como ativo. */
  activePrefixes: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", shortLabel: "Início", icon: House, activePrefixes: [] },
  {
    href: "/preparar-missa",
    label: "Missa",
    shortLabel: "Missa",
    icon: Church,
    activePrefixes: ["/preparar-missa", "/celebracoes"],
  },
  {
    href: "/catalogo",
    label: "Catálogo",
    shortLabel: "Catálogo",
    icon: BookOpen,
    activePrefixes: ["/catalogo"],
  },
  {
    href: "/repertorios",
    label: "Repertórios",
    shortLabel: "Repertórios",
    icon: Layers,
    activePrefixes: ["/repertorios"],
  },
  {
    // No computador, a conta fica no menu "Conta" do cabeçalho, junto de "Minhas músicas".
    href: "/conta",
    label: "Conta",
    shortLabel: "Conta",
    mobileOnly: true,
    icon: UserRound,
    activePrefixes: ["/conta", "/compartilhamentos", "/admin", "/biblioteca", "/musicas"],
  },
];

/** `pathname` é nulo no HTML inicial de rotas dinâmicas, antes de a URL ser conhecida. */
function isItemActive(item: NavItem, pathname: string | null): boolean {
  if (pathname === null) {
    return false;
  }
  if (item.href === "/") {
    return pathname === "/";
  }
  return item.activePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function TopLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Navegação principal" className="hidden shrink-0 md:block">
      <ul className="flex items-stretch gap-1 lg:gap-3">
        {NAV_ITEMS.filter((item) => !item.mobileOnly).map((item) => {
          const active = isItemActive(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-11 min-w-16 items-center justify-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap transition-colors",
                  active ? "bg-white/10 text-header-foreground" : "text-header-muted hover:bg-white/5 hover:text-header-foreground",
                )}
              >
                <item.icon className="size-[1.1rem] stroke-[1.7]" aria-hidden />
                <span className="font-medium">{item.label}</span>
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-header-accent transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function BottomLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav
      data-app-chrome
      data-print-hide
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = isItemActive(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors [@media(max-height:520px)]:h-12 [@media(max-height:520px)]:gap-0",
                  active ? "font-semibold text-primary" : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <span className={cn("grid h-7 w-11 place-items-center rounded-lg", active && "bg-primary/10")}><item.icon className="size-5 stroke-[1.7]" aria-hidden /></span>
                {item.shortLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function CurrentTopLinks() {
  return <TopLinks pathname={usePathname()} />;
}

function CurrentBottomLinks() {
  return <BottomLinks pathname={usePathname()} />;
}

export function TopNav() {
  return (
    <Suspense fallback={<TopLinks pathname={null} />}>
      <CurrentTopLinks />
    </Suspense>
  );
}

export function BottomNav() {
  return (
    <Suspense fallback={<BottomLinks pathname={null} />}>
      <CurrentBottomLinks />
    </Suspense>
  );
}
