"use client";

import { cn } from "cn";
import { Music } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { LibraryGate } from "@/features/library/components/library-gate";

import { sortSongsByTitle } from "../services/song-filters";
import { SongLibrary } from "./song-library";

export function SongLibraryScreen() {
  return (
    <LibraryGate fallback={<ContentSkeleton />}>
      {({ songs }) =>
        songs.length === 0 ? (
          <EmptyState
            icon={Music}
            title="Sua biblioteca está vazia"
            description="Cadastre sua primeira música para começar."
            action={
              <Link
                href="/musicas/nova"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                Cadastrar música
              </Link>
            }
          />
        ) : (
          <SongLibrary songs={sortSongsByTitle(songs)} />
        )
      }
    </LibraryGate>
  );
}
