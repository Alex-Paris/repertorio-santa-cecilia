import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { KeyLabel } from "@/features/songs/components/key-label";
import { momentLabel, type LiturgicalMomentId } from "@/features/liturgy/domain/vocabulary";
import { transposableKey, type MusicalSong } from "@/features/songs/domain/song";
import { transposeKey } from "@/features/songs/domain/transposition";

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
  href: string | null;
  direction: "previous" | "next";
}

function NeighborLink({ href, direction }: NeighborLinkProps) {
  const isPrevious = direction === "previous";
  const label = isPrevious ? "Anterior" : "Próxima";
  const Icon = isPrevious ? ChevronLeft : ChevronRight;
  const icon = <Icon data-icon={isPrevious ? "inline-start" : "inline-end"} aria-hidden />;

  if (!href) {
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
      href={href}
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

  const originalKey = transposableKey(song);
  return <RepertoireReadingFrame name={repertoire.name} href={`/repertorios/${repertoire.id}`}
    configuredKey={originalKey ? transposeKey(originalKey, item.transposeSemitones) : undefined} notes={item.notes} moment={item.moment}
    navigation={navigation ? {
      position: navigation.position, total: navigation.total,
      previousHref: navigation.previous ? getRepertoireSongHref(repertoire.id, navigation.previous) : null,
      nextHref: navigation.next ? getRepertoireSongHref(repertoire.id, navigation.next) : null,
    } : undefined} />;
}

interface RepertoireReadingFrameProps {
  name: string;
  href: string;
  configuredKey?: string;
  notes?: string;
  moment?: LiturgicalMomentId;
  navigation?: { position: number; total: number; previousHref: string | null; nextHref: string | null };
}

/** Estrutura comum aos repertórios particulares e publicados, sem consultar dados privados. */
export function RepertoireReadingFrame({ name, href, configuredKey, notes, moment, navigation }: RepertoireReadingFrameProps) {
  return (
    <aside aria-label="Leitura no repertório" className="mb-4 rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Repertório:{" "}
        <Link
          href={href}
          className="font-medium text-foreground underline underline-offset-3"
        >
          {name}
        </Link>
      </p>

      {moment && <p className="mt-1 text-sm text-muted-foreground">Momento da missa: {momentLabel(moment)}</p>}

      {configuredKey && (
        <p className="mt-1 flex items-baseline gap-1.5 text-sm text-muted-foreground">
          <span aria-hidden>Tom configurado</span>
          <KeyLabel musicalKey={configuredKey} />
        </p>
      )}

      {notes && (
        <div className="mt-3">
          <h2 className="text-sm font-medium">Anotações</h2>
          <p className="mt-0.5 text-sm text-pretty wrap-break-word whitespace-pre-line">
            {notes}
          </p>
        </div>
      )}

      {navigation && (
        <nav
          aria-label="Músicas do repertório"
          className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3"
        >
          <NeighborLink href={navigation.previousHref} direction="previous" />
          <span className="text-sm text-muted-foreground tabular-nums">
            Música {navigation.position} de {navigation.total}
          </span>
          <NeighborLink href={navigation.nextHref} direction="next" />
        </nav>
      )}
    </aside>
  );
}
