import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { KeyLabel } from "@/features/songs/components/key-label";
import { transposableKey, type MusicalSong } from "@/features/songs/domain/song";
import { transposeKey } from "@/features/songs/domain/transposition";

import type { RepertoireItem } from "../domain/repertoire";
import { getRepertoireNavigation } from "../services/repertoire-navigation";
import {
  getRepertoireSongHref,
  type RepertoireReadingContext,
} from "../services/repertoire-reading-context";

interface RepertoireReadingPanelProps {
  song: MusicalSong;
  context: RepertoireReadingContext;
}

interface NeighborLinkProps {
  repertoireId: string;
  item: RepertoireItem | null;
  direction: "previous" | "next";
}

function NeighborLink({ repertoireId, item, direction }: NeighborLinkProps) {
  const isPrevious = direction === "previous";
  const label = isPrevious ? "Anterior" : "Próxima";
  const Icon = isPrevious ? ChevronLeft : ChevronRight;
  const icon = <Icon data-icon={isPrevious ? "inline-start" : "inline-end"} aria-hidden />;

  if (!item) {
    return (
      <Button variant="outline" size="lg" disabled>
        {isPrevious && icon}
        {label}
        {!isPrevious && icon}
      </Button>
    );
  }

  return (
    <Link
      href={getRepertoireSongHref(repertoireId, item)}
      className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
    >
      {isPrevious && icon}
      {label}
      {!isPrevious && icon}
    </Link>
  );
}

export function RepertoireReadingPanel({ song, context }: RepertoireReadingPanelProps) {
  const { repertoire, item } = context;
  const navigation = getRepertoireNavigation(repertoire, item.id);

  return (
    <aside aria-label="Leitura no repertório" className="mb-4 rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Repertório:{" "}
        <Link
          href={`/repertorios/${repertoire.id}`}
          className="font-medium text-foreground underline underline-offset-3"
        >
          {repertoire.name}
        </Link>
      </p>

      {transposableKey(song) && (
        <p className="mt-1 flex items-baseline gap-1.5 text-sm text-muted-foreground">
          <span aria-hidden>Tom configurado</span>
          <KeyLabel musicalKey={transposeKey(transposableKey(song) as NonNullable<ReturnType<typeof transposableKey>>, item.transposeSemitones)} />
        </p>
      )}

      {item.notes && (
        <div className="mt-3">
          <h2 className="text-sm font-medium">Anotações</h2>
          <p className="mt-0.5 text-sm text-pretty wrap-break-word whitespace-pre-line">
            {item.notes}
          </p>
        </div>
      )}

      {navigation && (
        <nav
          aria-label="Músicas do repertório"
          className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3"
        >
          <NeighborLink repertoireId={repertoire.id} item={navigation.previous} direction="previous" />
          <span className="text-sm text-muted-foreground tabular-nums">
            Música {navigation.position} de {navigation.total}
          </span>
          <NeighborLink repertoireId={repertoire.id} item={navigation.next} direction="next" />
        </nav>
      )}
    </aside>
  );
}
