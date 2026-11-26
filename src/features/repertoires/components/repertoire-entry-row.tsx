import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { momentLabel } from "@/features/liturgy/domain/vocabulary";
import { KeyLabel } from "@/features/songs/components/key-label";

import type { RepertoireId } from "../domain/repertoire";
import { getRepertoireSongHref } from "../services/repertoire-reading-context";
import type { RepertoireEntry } from "../services/repertoire-service";

interface RepertoireEntryRowProps {
  repertoireId: RepertoireId;
  entry: RepertoireEntry;
  number: number;
  controls?: ReactNode;
  /** Painel exibido abaixo da linha, como o ajuste de tom e anotações. */
  details?: ReactNode;
}

function EntryNumber({ number }: { number: number }) {
  return (
    <span className="w-5 shrink-0 text-right font-mono text-sm text-muted-foreground tabular-nums">
      {number}
    </span>
  );
}

export function RepertoireEntryRow({
  repertoireId,
  entry,
  number,
  controls,
  details,
}: RepertoireEntryRowProps) {
  const { item, song, preferredKey } = entry;

  return (
    <li data-item-id={item.id}>
      <div className="flex items-center">
        {song ? (
          <Link
            href={getRepertoireSongHref(repertoireId, item)}
            className="flex min-w-0 flex-1 items-center gap-3 px-3 py-4 sm:px-4 transition-colors hover:bg-muted"
          >
            <EntryNumber number={number} />
            <div className="min-w-0 flex-1">
              {item.moment && (
                <span className="block wrap-break-word text-xs text-muted-foreground">{momentLabel(item.moment)}</span>
              )}
              <p className="wrap-break-word font-medium">{song.title}</p>
              <p className="wrap-break-word text-sm text-muted-foreground">{song.artist}</p>
              {item.notes && (
                <p className="mt-1 text-sm text-pretty wrap-break-word whitespace-pre-line">
                  {item.notes}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end">
              {(preferredKey ?? song.originalKey) ? (
                <KeyLabel musicalKey={(preferredKey ?? song.originalKey) as string} />
              ) : (
                <span className="text-xs text-muted-foreground">Tom não informado</span>
              )}
              {preferredKey && song.originalKey && (
                <span className="text-xs text-muted-foreground">original {song.originalKey}</span>
              )}
            </div>
            {!controls && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-4 sm:px-4">
            <EntryNumber number={number} />
            <p className="text-sm text-muted-foreground">
              {item.moment && <span className="block text-xs">{momentLabel(item.moment)}</span>}
              {item.source === "catalog"
                ? "Música indisponível no catálogo"
                : "Música indisponível na biblioteca"}
            </p>
          </div>
        )}
        {controls && (
          <div className="flex shrink-0 justify-end py-2 pr-3">
            {controls}
          </div>
        )}
      </div>
      {details && <div className="border-t px-4 py-4">{details}</div>}
    </li>
  );
}
