"use client";

import { ChevronRight, Library as LibraryIcon, ListMusic, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { RepertoireCard } from "@/features/repertoires/components/repertoire-card";
import type { Repertoire } from "@/features/repertoires/domain/repertoire";

import type { Library } from "../domain/library";
import { ExportBackupButton } from "./export-backup-button";
import { LegacyLibraryNotice } from "./legacy-library-notice";
import { LibraryGate } from "./library-gate";

const FEATURED_REPERTOIRES_LIMIT = 2;

interface SectionTileProps {
  href: string;
  icon: LucideIcon;
  count: number;
  label: string;
}

function SectionTile({ href, icon: Icon, count, label }: SectionTileProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted"
    >
      <Icon className="size-5 shrink-0 text-chord" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-2xl leading-none font-semibold tabular-nums">{count}</p>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

function getRecentRepertoires(repertoires: readonly Repertoire[]): Repertoire[] {
  return [...repertoires]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, FEATURED_REPERTOIRES_LIMIT);
}

function Overview({ library }: { library: Library }) {
  const { songs, repertoires } = library;
  const featuredRepertoires = getRecentRepertoires(repertoires);

  return (
    <>
      <LegacyLibraryNotice />
      <nav aria-label="Acesso rápido" className="grid gap-3 sm:grid-cols-2">
        <SectionTile
          href="/biblioteca"
          icon={LibraryIcon}
          count={songs.length}
          label={songs.length === 1 ? "Música" : "Músicas"}
        />
        <SectionTile
          href="/repertorios"
          icon={ListMusic}
          count={repertoires.length}
          label={repertoires.length === 1 ? "Repertório" : "Repertórios"}
        />
      </nav>

      {featuredRepertoires.length > 0 && (
        <section aria-labelledby="repertorios-em-destaque" className="mt-8 md:mt-10">
          <h2 id="repertorios-em-destaque" className="mb-3 text-lg font-semibold tracking-tight">
            Repertórios em destaque
          </h2>
          <ul className="space-y-3">
            {featuredRepertoires.map((repertoire) => (
              <RepertoireCard key={repertoire.id} repertoire={repertoire} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="backup" className="mt-8 md:mt-10">
        <h2 id="backup" className="text-lg font-semibold tracking-tight">
          Backup
        </h2>
        <p className="mt-1 mb-3 text-sm text-pretty text-muted-foreground">
          Exporte um arquivo JSON para guardar uma cópia das músicas e repertórios da sua conta.
        </p>
        <ExportBackupButton />
      </section>
    </>
  );
}

export function HomeOverview() {
  return (
    <LibraryGate fallback={<ContentSkeleton />}>
      {(library) => <Overview library={library} />}
    </LibraryGate>
  );
}
