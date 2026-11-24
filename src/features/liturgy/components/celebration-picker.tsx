import { cn } from "cn";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { FormError } from "@/components/layout/form-error";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  REVIEW_STATUS_LABELS,
  celebrationDisplayTitle,
  formatLongDate,
  type CelebrationSummary,
  type ReviewStatus,
} from "../domain/calendar";
import { seasonLabel } from "../domain/vocabulary";
import { LiturgicalColorMark } from "./liturgical-color";

interface CelebrationDateFormProps {
  date?: string;
  error?: string;
  /** Rótulo visível do campo; a página inicial usa um texto próprio. */
  label?: string;
}

/** Formulário simples de navegação: funciona sem JavaScript e sem login. */
export function CelebrationDateForm({ date, error, label = "Data da celebração" }: CelebrationDateFormProps) {
  return (
    <form action="/preparar-missa" method="get" className="space-y-2">
      <label htmlFor="data-da-celebracao" className="block text-sm font-medium">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="data-da-celebracao"
          type="date"
          name="data"
          required
          defaultValue={date}
          aria-invalid={error ? true : undefined}
          className="h-11 w-auto min-w-44 flex-1 bg-field sm:flex-none"
        />
        <button type="submit" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}>
          Ver celebração
        </button>
      </div>
      {error && <FormError message={error} />}
    </form>
  );
}

const STATUS_TONE: Record<ReviewStatus, string> = {
  reviewed: "border-success/30 bg-success/8 text-success",
  pending_review: "border-warning/30 bg-warning/8 text-warning",
  needs_update: "border-info/30 bg-info/8 text-info",
  disputed: "border-destructive/30 bg-destructive/8 text-destructive",
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span className={cn("inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium", STATUS_TONE[status])}>
      {REVIEW_STATUS_LABELS[status]}
    </span>
  );
}

interface CelebrationListProps {
  celebrations: CelebrationSummary[];
  title: string;
  description?: string;
  /** Link para a busca completa, quando a lista mostra só uma parte. */
  more?: { href: string; label: string };
  headingLevel?: "h2" | "h3";
}

/** Celebrações com cobertura. A lista é a cobertura real da base, não um calendário. */
export function CelebrationList({ celebrations, title, description, more, headingLevel: Heading = "h2" }: CelebrationListProps) {
  const headingId = `lista-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <Heading id={headingId} className="font-display text-xl font-semibold tracking-tight">
        {title}
      </Heading>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {celebrations.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma celebração encontrada.
        </p>
      ) : (
        <ul className="mt-3 divide-y rounded-2xl border bg-card">
          {celebrations.map((entry) => (
            <li key={entry.celebrationId}>
              <Link
                href={`/preparar-missa?data=${entry.date}&celebracao=${encodeURIComponent(entry.celebrationId)}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium wrap-break-word">{celebrationDisplayTitle(entry)}</span>
                  <span className="block text-sm text-muted-foreground first-letter:uppercase">{formatLongDate(entry.date)}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {seasonLabel(entry.season)}
                    {entry.color && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="sr-only">cor litúrgica: </span>
                        <LiturgicalColorMark color={entry.color} />
                      </>
                    )}
                    <ReviewStatusBadge status={entry.reviewStatus} />
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {more && (
        <Link href={more.href} className="mt-3 inline-block text-sm font-medium underline underline-offset-3">
          {more.label}
        </Link>
      )}
    </section>
  );
}
