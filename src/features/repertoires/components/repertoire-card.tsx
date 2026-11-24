import { CalendarDays, ChevronRight } from "lucide-react";
import Link from "next/link";

import { formatShortDate } from "@/features/liturgy/domain/calendar";
import { formatSongCount } from "@/features/songs/domain/song";

import type { Repertoire } from "../domain/repertoire";

/**
 * Um repertório na lista: nome, a missa (data e celebração) quando houver e a quantidade de
 * músicas numa só linha de apoio. A descrição aparece numa linha, cortada se for longa.
 */
export function RepertoireCard({ repertoire }: { repertoire: Repertoire }) {
  return (
    <li>
      <Link
        href={`/repertorios/${repertoire.id}`}
        className="interactive-card flex min-h-24 items-center gap-4 rounded-2xl border bg-card p-5 hover:bg-muted/50"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium text-heading">{repertoire.name}</p>
          {repertoire.description && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{repertoire.description}</p>
          )}
          <p className="mt-1.5 flex flex-wrap items-start gap-x-4 gap-y-0.5 text-xs font-medium text-muted-foreground">
            {repertoire.mass && (
              <span className="inline-flex items-start gap-1">
                <CalendarDays className="mt-px size-3.5 shrink-0 text-gold-strong" aria-hidden />
                <span>
                  {formatShortDate(repertoire.mass.date)} · {repertoire.mass.title}
                  <span className="sr-only">.</span>
                </span>
              </span>
            )}
            <span>{formatSongCount(repertoire.items.length)}</span>
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
