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
        className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium text-heading">{repertoire.name}</p>
          {repertoire.description && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{repertoire.description}</p>
          )}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-muted-foreground">
            {repertoire.mass && (
              <>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5 text-gold-strong" aria-hidden />
                  {formatShortDate(repertoire.mass.date)} · {repertoire.mass.title}
                </span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{formatSongCount(repertoire.items.length)}</span>
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
