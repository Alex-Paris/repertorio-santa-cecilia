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
      className="flex items-center gap-3 rounded-xl border bg-background/60 p-3 transition-colors hover:bg-muted"
    >
      <Icon className="size-5 shrink-0 text-gold" aria-hidden />
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
      <nav aria-label="Acesso rápido" className="grid grid-cols-2 gap-2">
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
        <section aria-labelledby="repertorios-recentes" className="mt-5">
          <h3 id="repertorios-recentes" className="mb-2 text-sm font-semibold text-heading">
            Editados recentemente
          </h3>
          <ul className="space-y-2">
            {featuredRepertoires.map((repertoire) => (
              <RepertoireCard key={repertoire.id} repertoire={repertoire} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="backup" className="mt-5 border-t pt-4">
        <h3 id="backup" className="text-sm font-semibold text-heading">
          Backup
        </h3>
        <p className="mt-0.5 mb-3 text-sm text-pretty text-muted-foreground">
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
