"use client";

import { themeInitScript } from "@/lib/utils/theme";

/**
 * O script só precisa rodar na carga inicial do HTML. No cliente o tipo muda
 * para `text/plain`, evitando o aviso do React sobre renderizar tags <script>.
 */
export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeInitScript }}
    />
  );
}
