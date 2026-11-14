import { ChevronRight } from "lucide-react";
import Link from "next/link";

import type { Song } from "../domain/song";
import { ContentTypeBadge } from "./content-type-badge";
import { KeyLabel } from "./key-label";

export function SongListItem({ song }: { song: Song }) {
  return (
    <li>
      <Link
        href={`/musicas/${song.id}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{song.title}</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate text-sm text-muted-foreground">{song.artist}</p>
            <ContentTypeBadge contentType={song.contentType} />
          </div>
        </div>
        <KeyLabel musicalKey={song.originalKey} />
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
