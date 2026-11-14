"use client";

import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { LibraryGate } from "@/features/library/components/library-gate";
import {
  getSongReadingHref,
  resolveRepertoireReadingContext,
  type RepertoireContextReference,
} from "@/features/repertoires/services/repertoire-reading-context";

import type { SongId } from "../domain/song";
import { SongForm } from "./song-form";
import { SongNotFound } from "./song-not-found";

/** Cria uma música ou, com `songId`, edita a existente. */
export function SongFormScreen({
  songId,
  contextReference,
}: {
  songId?: SongId;
  /** IDs vindos da URL; só valem depois de conferidos com os dados salvos. */
  contextReference?: RepertoireContextReference;
}) {
  // Novas navegações abrem o formulário limpo; voltar e avançar preservam o rascunho.
  const { bfcacheId } = useRouter();

  return (
    <LibraryGate>
      {({ songs, repertoires }) => {
        if (!songId) {
          return (
            <>
              <PageHeader title="Nova música" back={{ href: "/biblioteca", label: "Músicas" }} />
              <SongForm key={bfcacheId} />
            </>
          );
        }

        const song = songs.find((candidate) => candidate.id === songId);
        if (!song) {
          return <SongNotFound />;
        }

        const context = contextReference
          ? resolveRepertoireReadingContext(repertoires, song.id, contextReference)
          : null;
        const returnHref = getSongReadingHref(song.id, context);

        return (
          <>
            <PageHeader title="Editar música" back={{ href: returnHref, label: song.title }} />
            <SongForm key={bfcacheId} song={song} returnHref={returnHref} />
          </>
        );
      }}
    </LibraryGate>
  );
}
