import { Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { SANTA_CECILIA_CREDIT } from "@/components/brand/santa-cecilia";

import { AccountMenu } from "./account-menu";
import { Brand } from "./brand";
import { LegalLinks } from "./legal-links";
import { BottomNav, TopNav } from "./navigation";
import { ThemeToggle } from "./theme-toggle";
import { Toaster } from "./toaster";

/**
 * Cabeçalho com a marca, a navegação principal, a busca e a conta; no celular, barra
 * inferior. As páginas largas (início, missa, catálogo) marcam `data-layout="wide"` e usam
 * a largura das referências; as demais continuam em coluna de leitura. Nada disso vai para a
 * impressão (`data-print-hide`).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div data-print-shell className="flex min-h-dvh flex-col">
      <a
        data-app-chrome
        data-print-hide
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Ir para o conteúdo
      </a>

      {/* Em telas baixas (zoom de 200%, celular deitado), o cabeçalho rola com a página para sobrar espaço. */}
      <header
        data-app-chrome
        data-print-hide
        className="sticky top-0 z-30 border-b bg-header text-header-foreground [@media(max-height:520px)]:static"
      >
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-3 px-4 lg:grid lg:h-[4.5rem] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6 lg:px-6">
          <Brand />
          <TopNav />
          <div className="hidden items-center gap-2 lg:flex lg:justify-self-end">
            <ThemeToggle className="text-header-foreground hover:bg-white/10 hover:text-header-foreground" />
            <AccountMenu />
          </div>
          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <Link
              href="/catalogo"
              aria-label="Buscar no catálogo"
              className="flex size-11 items-center justify-center rounded-lg text-header-foreground hover:bg-white/10"
            >
              <Search className="size-5" aria-hidden />
            </Link>
            <ThemeToggle className="text-header-foreground hover:bg-white/10 hover:text-header-foreground" />
          </div>
        </div>
      </header>

      <main
        id="conteudo"
        tabIndex={-1}
        // Largura toda: a coluna de leitura, as margens e o espaço sob o cabeçalho vêm das
        // regras de layout em globals.css, aplicadas a cada bloco visível (não ao `main` inteiro).
        className="w-full flex-1 pb-10 lg:pb-12"
      >
        {children}
      </main>

      <footer
        data-app-chrome
        data-print-hide
        className="mt-8 w-full border-t bg-card/40 px-4 pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))] text-center text-xs leading-relaxed text-muted-foreground lg:pb-6"
      >
        <LegalLinks />
        <p className="mt-2">{SANTA_CECILIA_CREDIT}</p>
      </footer>

      <BottomNav />
      <Toaster />
    </div>
  );
}
