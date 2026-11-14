"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { FormError } from "@/components/layout/form-error";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { createLibraryApi } from "@/features/library/data/remote/library-api";
import { getLibraryErrorMessage } from "@/features/library/domain/library-errors";

import {
  QUALITY_ISSUE_LABELS,
  QUALITY_ISSUES,
  READINESS,
  READINESS_LABELS,
  type Readiness,
} from "../domain/catalog-quality";
import { CATALOG_STATUSES } from "../domain/catalog-song";

const responseSchema = z.object({
  examined: z.number(),
  truncated: z.boolean(),
  entries: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      artist: z.string(),
      status: z.enum(CATALOG_STATUSES),
      readiness: z.enum(READINESS),
      hasChordPro: z.boolean(),
      issues: z.array(z.object({ code: z.enum(QUALITY_ISSUES), detail: z.string() })),
    }),
  ),
});

type QualityReport = z.infer<typeof responseSchema>;

const STATUS_LABELS = { draft: "Rascunho", published: "Publicada", unpublished: "Despublicada" } as const;

/** Pontos a revisar na classificação. Só aponta: a correção é feita no editor de cada música. */
export function CatalogQualityReport({ userId }: { userId: string }) {
  const api = useMemo(() => createLibraryApi({ userId, basePath: "/api/v1/admin/catalog" }), [userId]);
  const [report, setReport] = useState<QualityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Readiness | "">("");

  useEffect(() => {
    let active = true;
    api.request("/quality", responseSchema).then(
      (loaded) => active && setReport(loaded),
      (caught: unknown) => active && setError(getLibraryErrorMessage(caught)),
    );
    return () => {
      active = false;
    };
  }, [api]);

  if (error) {
    return <FormError message={error} />;
  }
  if (!report) {
    return <ContentSkeleton />;
  }

  const counts = READINESS.map((code) => ({
    code,
    count: report.entries.filter((entry) => entry.readiness === code).length,
  }));
  const entries = filter ? report.entries.filter((entry) => entry.readiness === filter) : report.entries;
  const withoutChords = report.entries.filter((entry) => !entry.hasChordPro).length;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {report.examined} músicas examinadas{report.truncated && " (as primeiras, em ordem de título)"}. Nenhuma
        classificação é preenchida automaticamente, e os direitos não são alterados aqui. {withoutChords} sem cifra
        exibível no catálogo.
      </p>
      <p className="text-sm text-muted-foreground">
        “Pronta para recomendação” exige classificação completa e conferida por uma pessoa da equipe. Classificações
        não conferidas também geram sugestões, mas sempre marcadas como não conferidas.
      </p>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Filtrar por situação da classificação</legend>
        <button
          type="button"
          aria-pressed={filter === ""}
          onClick={() => setFilter("")}
          className="rounded-full border px-3 py-1.5 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          Todos ({report.entries.length})
        </button>
        {counts.map(({ code, count }) => (
          <button
            key={code}
            type="button"
            aria-pressed={filter === code}
            onClick={() => setFilter(code)}
            className="rounded-full border px-3 py-1.5 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {READINESS_LABELS[code]} ({count})
          </button>
        ))}
      </fieldset>
      {entries.length === 0 ? (
        <p className="text-sm">Nenhuma música nesta situação.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {entries.map((entry) => (
            <li key={entry.id} className="px-4 py-3">
              <Link href={`/admin/catalogo/${entry.id}`} className="font-medium underline-offset-3 hover:underline">
                {entry.title}
              </Link>
              <span className="text-sm text-muted-foreground">
                {" "}
                · {entry.artist || "Autoria não informada"} · {STATUS_LABELS[entry.status]} ·{" "}
                {READINESS_LABELS[entry.readiness]}
                {!entry.hasChordPro && " · sem cifra"}
              </span>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                {entry.issues.map((issue) => (
                  <li key={`${issue.code}-${issue.detail}`}>
                    <span className="font-medium">{QUALITY_ISSUE_LABELS[issue.code]}:</span> {issue.detail}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
