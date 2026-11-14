"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";

import type { RepertoireMass } from "@/features/repertoires/domain/repertoire";

import { REVIEW_STATUS_LABELS, REVIEW_STATUSES } from "../domain/calendar";
import { ReviewStatusBadge } from "./celebration-picker";

const responseSchema = z.object({
  celebration: z.object({
    celebrationId: z.string(),
    revision: z.number(),
    review: z.object({ status: z.enum(REVIEW_STATUSES) }),
  }),
});

type State =
  | { kind: "loading" }
  | { kind: "found"; revision: number; status: (typeof REVIEW_STATUSES)[number] }
  | { kind: "missing" }
  | { kind: "unavailable" };

/**
 * Situação atual da celebração vinculada ao repertório. Só informa: as músicas, os tons e as
 * anotações da pessoa nunca mudam por causa de uma revisão da celebração.
 */
export function MassCelebrationStatus({ mass, repertoireId }: { mass: RepertoireMass; repertoireId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const celebrationId = mass.celebrationId;

  useEffect(() => {
    if (!celebrationId) {
      return;
    }
    let active = true;
    fetch(`/api/v1/liturgy/celebrations/${encodeURIComponent(celebrationId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) {
          return { kind: "missing" } as const;
        }
        const parsed = responseSchema.safeParse(response.ok ? await response.json() : null);
        return parsed.success
          ? ({ kind: "found", revision: parsed.data.celebration.revision, status: parsed.data.celebration.review.status } as const)
          : ({ kind: "unavailable" } as const);
      })
      .catch(() => ({ kind: "unavailable" }) as const)
      .then((next) => active && setState(next));
    return () => {
      active = false;
    };
  }, [celebrationId]);

  if (!celebrationId || state.kind === "loading" || state.kind === "unavailable") {
    return null;
  }

  if (state.kind === "missing") {
    return (
      <p className="mt-2 text-sm">
        Esta celebração não está na base de celebrações agora. O repertório continua como está.
      </p>
    );
  }

  const changed = mass.celebrationRevision !== undefined && state.revision > mass.celebrationRevision;
  return (
    <div className="mt-2 space-y-1 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <span className="sr-only">Situação da celebração: {REVIEW_STATUS_LABELS[state.status]}</span>
        <ReviewStatusBadge status={state.status} />
      </p>
      {changed && (
        <p role="note">
          A celebração foi atualizada ou revisada depois que este repertório foi montado. Suas músicas, tons e anotações não
          foram alterados.{" "}
          <Link
            href={`/preparar-missa?data=${mass.date}&celebracao=${encodeURIComponent(celebrationId)}&repertorio=${repertoireId}`}
            className="font-medium text-foreground underline underline-offset-3"
          >
            Ver a celebração atual
          </Link>
        </p>
      )}
    </div>
  );
}
