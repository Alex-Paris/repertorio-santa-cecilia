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
    <nav aria-label="Navegação principal" className="hidden min-w-0 md:block">
      <ul className="flex items-stretch gap-1 lg:gap-3">
        {NAV_ITEMS.filter((item) => !item.mobileOnly).map((item) => {
          const active = isItemActive(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-14 min-w-16 flex-col items-center justify-center gap-0.5 rounded-lg px-3 text-[0.95rem] whitespace-nowrap transition-colors lg:h-[4.25rem] lg:min-w-[5.5rem]",
                  active ? "text-header-foreground" : "text-header-foreground/85 hover:bg-white/5 hover:text-header-foreground",
                )}
              >
                <item.icon className="size-[1.35rem] stroke-[1.5]" aria-hidden />
                <span className="font-display font-medium">{item.label}</span>
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-3 bottom-1.5 h-0.5 rounded-full bg-header-accent transition-opacity",
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
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  active ? "text-heading" : "text-muted-foreground",
                )}
              >
                <item.icon className={cn("size-5 stroke-[1.6]", active && "text-gold-strong")} aria-hidden />
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
