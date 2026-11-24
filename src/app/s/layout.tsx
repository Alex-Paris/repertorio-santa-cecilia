import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Repertório compartilhado",
  // `noindex` evita a indexação, mas não controla o acesso: quem tem o link consegue abrir.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** A mesma navegação do site; a leitura publicada continua sem exigir autenticação. */
export default function PublicShareLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
