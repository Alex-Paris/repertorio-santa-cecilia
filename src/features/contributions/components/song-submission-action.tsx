"use client";

import { cn } from "cn";
import { Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { MENU_ITEM_CLASS } from "@/components/layout/more-actions-menu";
import { buttonVariants } from "@/components/ui/button";
import { accountLibrary } from "@/features/library/data/browser-library";

import { createSubmissionApi } from "../data/submission-api";
import { SUBMISSION_STATUS_LABELS, type SubmissionSummary } from "../domain/submission";

/** Sugestão mais relevante para uma música particular: a em andamento ou, se não houver, a mais recente. */
/** `null` para músicas do catálogo: não há o que consultar. */
export function useSongSubmission(songId: string | null): { userId: string | null; submission: SubmissionSummary | null } {
  const userId = accountLibrary.getRemoteUserId();
  const [found, setFound] = useState<{ key: string; submission: SubmissionSummary | null } | null>(null);
  const key = `${userId ?? ""}:${songId}`;

  useEffect(() => {
    if (!userId || !songId) {
      return;
    }
    const controller = new AbortController();
    createSubmissionApi(userId)
      .listMine(controller.signal)
      .then(
        (submissions) => {
          const forSong = submissions.filter((entry) => entry.personalSongId === songId);
          const active = forSong.find((entry) => entry.status === "pending" || entry.status === "needs_changes");
          setFound({ key: `${userId}:${songId}`, submission: active ?? forSong[0] ?? null });
        },
        // Sem a lista, a ação de sugerir continua disponível; o servidor confere tudo no envio.
        () => undefined,
      );
    return () => controller.abort();
  }, [userId, songId]);

  return { userId, submission: found?.key === key ? found.submission : null };
}

export function isActiveSubmission(submission: SubmissionSummary | null): boolean {
  return submission?.status === "pending" || submission?.status === "needs_changes";
}

/** Ação na página da música particular. Só para quem está na própria conta. */
export function SongSubmissionAction({
  songId,
  submission,
  asMenuItem = false,
}: {
  songId: string;
  submission: SubmissionSummary | null;
  /** Dentro do menu "Mais" da página da música. */
  asMenuItem?: boolean;
}) {
  const className = asMenuItem ? MENU_ITEM_CLASS : cn(buttonVariants({ variant: "outline", size: "lg" }));
  if (submission && isActiveSubmission(submission)) {
    return (
      <Link href={`/conta/sugestoes/${encodeURIComponent(submission.id)}`} className={className}>
        <Send data-icon="inline-start" aria-hidden />
        Sugestão: {SUBMISSION_STATUS_LABELS[submission.status].toLowerCase()}
      </Link>
    );
  }
  return (
    <Link href={`/musicas/${encodeURIComponent(songId)}/sugerir`} className={className}>
      <Send data-icon="inline-start" aria-hidden />
      Sugerir para o catálogo
    </Link>
  );
}
