import { cn } from "cn";
import Link from "next/link";

import { SantaCeciliaMark } from "@/components/brand/santa-cecilia";

/** Marca do cabeçalho: detalhe da ilustração de Santa Cecília e o nome, sobre o oliva escuro. */
export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Repertório — início"
      className={cn("flex shrink-0 items-center gap-2.5 rounded-lg text-header-foreground", className)}
    >
      <SantaCeciliaMark className="size-9 lg:size-12" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-xl font-semibold tracking-tight lg:text-[1.95rem]">Repertório</span>
        <span className="mt-1 hidden text-[0.6rem] font-medium tracking-[0.28em] text-header-muted uppercase lg:block">
          Música e liturgia católica
        </span>
      </span>
    </Link>
  );
}
