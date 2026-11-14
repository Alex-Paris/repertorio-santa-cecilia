import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { formatSongCount } from "@/features/songs/domain/song";

import type { Repertoire } from "../domain/repertoire";

export function RepertoireCard({ repertoire }: { repertoire: Repertoire }) {
  return (
    <li>
      <Link
        href={`/repertorios/${repertoire.id}`}
        className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium">{repertoire.name}</p>
          {repertoire.description && (
            <p className="mt-0.5 text-sm text-pretty text-muted-foreground">
              {repertoire.description}
            </p>
          )}
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {formatSongCount(repertoire.items.length)}
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
