import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LegalLinks } from "@/components/layout/legal-links";

export const metadata: Metadata = {
  title: "Repertório compartilhado",
  // `noindex` evita a indexação, mas não controla o acesso: quem tem o link consegue abrir.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Sem navegação, sem dados de conta e sem recursos de terceiros. */
export default function PublicShareLayout({ children }: { children: ReactNode }) {
  return (
    <div data-print-shell className="flex min-h-dvh flex-col">
      <header data-app-chrome data-print-hide className="flex h-14 items-center justify-between border-b px-4 md:px-8">
        <p className="font-semibold">Repertório</p>
        <ThemeToggle />
      </header>
      {/* Mesma coluna de leitura das demais páginas (regras de layout em globals.css). */}
      <main id="conteudo" tabIndex={-1} className="w-full flex-1 pb-6 md:pb-10">
        {children}
      </main>
      <footer data-app-chrome data-print-hide className="border-t px-4 py-4 text-center text-muted-foreground md:px-8">
        <LegalLinks />
      </footer>
    </div>
  );
}
