import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

/** Telas da aplicação. Links públicos (`/s`) ficam fora: não têm navegação nem dados de conta. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
