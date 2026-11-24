import type { ReactNode } from "react";

import { PageHeader } from "@/components/layout/page-header";

import type { MusicalKey } from "../domain/musical-key";
import { KeyLabel } from "./key-label";

interface SongReadingHeaderProps {
  title: string;
  artist: string;
  originalKey?: MusicalKey;
  back: { href: string; label: string };
  badge?: ReactNode;
  actions: ReactNode;
}

export function SongReadingHeader({ title, artist, originalKey, back, badge, actions }: SongReadingHeaderProps) {
  return <PageHeader title={title} back={back} actions={actions} description={
    <>
      <p>{artist || "Autoria não informada"}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {originalKey ? <p className="flex items-baseline gap-1.5 text-sm"><span aria-hidden>Tom original</span><KeyLabel musicalKey={originalKey} /></p>
          : <p className="text-sm text-muted-foreground">Tom original não informado</p>}
        {badge}
      </div>
    </>
  } />;
}
