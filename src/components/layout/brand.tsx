import { cn } from "cn";
import Link from "next/link";

import { SantaCeciliaMark } from "@/components/brand/santa-cecilia";
import { SITE_NAME } from "@/lib/site";

/**
 * Marca do cabeçalho: o logotipo de Santa Cecília e o nome do site em duas linhas, "Repertório" e,
 * em itálico dourado, "Santa Cecília". O nome inteiro cabe no cabeçalho em todas as larguras sem
 * ficar mais largo que a marca anterior.
 */
export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${SITE_NAME} — início`}
      className={cn("flex shrink-0 items-center gap-2.5 rounded-lg text-header-foreground", className)}
    >
      <SantaCeciliaMark className="size-10 lg:size-12" />
      <span aria-hidden className="flex flex-col leading-none">
        <span className="font-display text-[1.2rem] font-semibold tracking-tight lg:text-[1.65rem]">Repertório</span>
        <span className="mt-0.5 font-display text-[0.86rem] font-medium tracking-[0.01em] text-header-accent italic lg:mt-1 lg:text-[1.08rem]">
          Santa Cecília
        </span>
      </span>
    </Link>
  );
}
