"use client";

import { cn } from "cn";
import { Info, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";

import { accountLibrary } from "../data/browser-library";
import { readBrowserLegacyLibrary } from "../legacy/legacy-library";
import { createMigrationAttemptStore } from "../migration/migration-attempts";

const DISMISSED_KEY = "repertorio.legacy-notice-dismissed.v1";

function shouldOffer(): boolean {
  try {
    if (window.localStorage.getItem(DISMISSED_KEY) !== null) {
      return false;
    }
  } catch {
    return false;
  }

  const legacy = readBrowserLegacyLibrary();
  if (legacy.status === "blocked") {
    return true;
  }
  if (legacy.status !== "ready" || legacy.onlyExamples) {
    return false;
  }

  const userId = accountLibrary.getRemoteUserId();
  const attempt = userId ? createMigrationAttemptStore(userId, () => window.localStorage).load() : null;
  return attempt?.status !== "completed";
}

/** Aviso discreto: o aplicativo funciona normalmente sem que nada seja importado. */
export function LegacyLibraryNotice() {
  const [visible, setVisible] = useState(shouldOffer);

  if (!visible) {
    return null;
  }

  function dismiss(): void {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Sem armazenamento, o aviso só volta a aparecer na próxima visita.
    }
    setVisible(false);
  }

  return (
    <aside className="mb-6 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="min-w-0 flex-1 text-muted-foreground">
        Encontramos uma biblioteca antiga guardada neste navegador. Ela não foi importada.{" "}
        <Link
          href="/conta/importar-biblioteca-antiga"
          className={cn("font-medium text-foreground underline underline-offset-3")}
        >
          Revisar
        </Link>
      </p>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Dispensar aviso"
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "-my-1 shrink-0")}
        onClick={dismiss}
      >
        <X aria-hidden />
      </Button>
    </aside>
  );
}
