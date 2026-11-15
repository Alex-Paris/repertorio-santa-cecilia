"use client";

import { cn } from "cn";
import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

function SearchField({ className }: { className?: string }) {
  return (
    <form action="/catalogo" method="get" role="search" className={cn("relative", className)}>
      <label htmlFor="busca-cabecalho" className="sr-only">
        Buscar músicas no catálogo por título ou autoria
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[1.15rem] -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        id="busca-cabecalho"
        type="search"
        name="q"
        maxLength={100}
        placeholder="Buscar músicas no catálogo…"
        className="h-10 w-full rounded-xl border border-transparent bg-card pr-3 pl-10 text-[0.95rem] text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-header-accent/60"
      />
    </form>
  );
}

/**
 * Na página do catálogo, a busca da própria página (com os filtros) faz o mesmo: o campo do
 * cabeçalho dá lugar a ela, para não haver duas buscas iguais lado a lado.
 */
function CurrentSearch({ className }: { className?: string }) {
  const pathname = usePathname();
  return pathname === "/catalogo" ? <div className={className} /> : <SearchField className={className} />;
}

/** Busca do cabeçalho. Leva ao catálogo (título ou autoria). Funciona sem JavaScript. */
export function HeaderSearch({ className }: { className?: string }) {
  return (
    <Suspense fallback={<SearchField className={className} />}>
      <CurrentSearch className={className} />
    </Suspense>
  );
}
