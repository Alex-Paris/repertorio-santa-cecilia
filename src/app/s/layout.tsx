import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/layout/theme-toggle";

export const metadata: Metadata = {
  title: "Repertório compartilhado",
  // `noindex` evita a indexação, mas não controla o acesso: quem tem o link consegue abrir.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Sem navegação, sem dados de conta e sem recursos de terceiros. */
export default function PublicShareLayout({ children }: { children: ReactNode }) {
  return (
    <div data-print-shell className="min-h-dvh">
      <header data-app-chrome data-print-hide className="flex h-14 items-center justify-between border-b px-4 md:px-8">
        <p className="font-semibold">Repertório</p>
        <ThemeToggle />
      </header>
      {/* Mesma coluna de leitura das demais páginas (regras de layout em globals.css). */}
      <main id="conteudo" tabIndex={-1} className="w-full pb-6 md:pb-10">
        {children}
      </main>
    </div>
  );
}
