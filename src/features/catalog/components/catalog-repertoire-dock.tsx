"use client";

import { cn } from "cn";
import { Lightbulb, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { useLibrary } from "@/features/library/components/use-library";
import type { Library } from "@/features/library/domain/library";
import { formatShortDate } from "@/features/liturgy/domain/calendar";
import { RepertoireBuilder, pickCurrentRepertoire } from "@/features/repertoires/components/repertoire-builder";

interface CatalogRepertoireDockProps {
  /** Repertório pedido no endereço; sem ele, o alterado mais recentemente. */
  repertoireId: string | null;
  /** Endereço atual sem o repertório, para trocar de repertório sem perder a busca. */
  locationHref: string;
  /** "Adicionar música": no catálogo, volta à busca; fora dele, abre o catálogo. */
  addMore: "search" | "catalog";
}

function withRepertoire(href: string, id: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}repertorio=${encodeURIComponent(id)}`;
}

/** Repertório atual, ao lado do catálogo: o que já está salvo na conta, com tom, ordem e remoção. */
export function CatalogRepertoireDock({ repertoireId, locationHref, addMore }: CatalogRepertoireDockProps) {
  const router = useRouter();
  const snapshot = useLibrary();
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const library = snapshot.status === "ready" ? snapshot.library : null;
  const current = choosing ? null : pickCurrentRepertoire(library, repertoireId);

  function select(id: string): void {
    setChoosing(false);
    router.replace(withRepertoire(locationHref, id), { scroll: false });
  }

  function focusSearch(): void {
    const field = document.getElementById("catalogo-busca");
    field?.scrollIntoView({ block: "center", behavior: "smooth" });
    field?.focus({ preventScroll: true });
    setOpen(false);
  }

  const subtitle = current?.mass ? `${current.mass.title} · ${formatShortDate(current.mass.date)}` : current?.name;

  return (
    <RepertoireBuilder
      label="Repertório atual"
      title="Repertório atual"
      subtitle={subtitle}
      emptySummary="Escolher um repertório"
      status={snapshot.status}
      library={library}
      repertoire={current}
      open={open}
      onToggle={() => setOpen((value) => !value)}
      chooser={library && <ChooseExisting library={library} selectedId={repertoireId} onSelect={select} />}
      emptyText="Ainda sem músicas. Escolha uma música no catálogo e use “Adicionar ao repertório”."
      onChangeRepertoire={() => setChoosing(true)}
      addMore={current ? (addMore === "search" ? { onClick: focusSearch } : { href: withRepertoire("/catalogo", current.id) }) : undefined}
      aside={
        <aside aria-labelledby="dica-catalogo" className="rounded-2xl border bg-card/80 p-4 text-sm">
          <h2 id="dica-catalogo" className="flex items-center gap-2 font-display text-lg font-semibold text-heading">
            <Lightbulb className="size-5 text-gold" aria-hidden />
            Dica
          </h2>
          <p className="mt-1 text-pretty text-muted-foreground">
            Abra uma música e use “Adicionar ao repertório”: ela entra no repertório atual, com o momento e o tom que você
            escolher. Tudo fica salvo na sua conta.
          </p>
        </aside>
      }
    />
  );
}

function ChooseExisting({ library, selectedId, onSelect }: { library: Library; selectedId: string | null; onSelect: (id: string) => void }) {
  const repertoires = [...library.repertoires].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <div className="space-y-3">
      {repertoires.length === 0 ? (
        <p className="text-sm">Você ainda não tem repertórios.</p>
      ) : (
        <>
          <p className="text-sm font-medium">Escolha o repertório atual:</p>
          <ul className="space-y-2">
            {repertoires.map((repertoire) => (
              <li key={repertoire.id}>
                <button
                  type="button"
                  aria-current={repertoire.id === selectedId ? "true" : undefined}
                  onClick={() => onSelect(repertoire.id)}
                  className="w-full rounded-xl border bg-background/50 px-3 py-2 text-left text-sm hover:bg-surface-alt aria-[current=true]:border-primary"
                >
                  <span className="block font-medium text-heading">{repertoire.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {repertoire.items.length === 1 ? "1 música" : `${repertoire.items.length} músicas`}
                    {repertoire.mass && ` · ${repertoire.mass.title}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href="/repertorios/novo" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full gap-2")}>
        <Plus className="size-4" aria-hidden />
        Criar repertório
      </Link>
    </div>
  );
}
