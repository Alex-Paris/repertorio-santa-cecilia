import { cn } from "cn";
import { Search } from "lucide-react";

/**
 * Busca do cabeçalho. Leva ao catálogo (título ou autoria), que é o que a busca de fato
 * consulta; celebrações têm a sua própria busca. Funciona sem JavaScript.
 */
export function HeaderSearch({ className }: { className?: string }) {
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
        placeholder="Buscar músicas ou autores…"
        className="h-10 w-full rounded-xl border border-transparent bg-card pr-3 pl-10 text-[0.95rem] text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-header-accent/60"
      />
    </form>
  );
}
