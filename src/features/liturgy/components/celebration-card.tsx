import { cn } from "cn";
import { ChevronDown, CircleAlert, CircleCheck, Clock } from "lucide-react";

import {
  CELEBRATION_RANK_LABELS,
  CELEBRATION_SCOPE_LABELS,
  FACT_FIELD_LABELS,
  READING_ROLE_LABELS,
  READING_ROLES,
  SOURCE_JURISDICTION_LABELS,
  SOURCE_VERIFICATION_LABELS,
  celebrationDisplayTitle,
  externalLiturgyUrl,
  formatLongDate,
  formatShortDate,
  type LiturgicalCelebrationContext,
} from "../domain/calendar";
import { seasonLabel, themeLabel } from "../domain/vocabulary";
import { LiturgicalColorMark } from "./liturgical-color";

const COLOR_BASIS = {
  source: "confirmada em fonte",
  rule: "pela regra geral da Instrução Geral do Missal Romano (n. 346), sem confirmação em fonte desta data",
} as const;

/** Estado editorial em linguagem para quem prepara a missa. Nunca sugere aprovação oficial da Igreja. */
export function ReviewNotice({ context }: { context: LiturgicalCelebrationContext }) {
  const { status, reviewedAt, disputedFields } = context.review;

  if (status === "reviewed") {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-primary/30 bg-secondary px-3 py-2.5 text-sm">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span>
          <span className="font-medium">Celebração revisada</span>
          {reviewedAt && ` em ${formatShortDate(reviewedAt.slice(0, 10))}`} pela equipe do Repertório Web, com base nas
          fontes abaixo. É uma revisão editorial, não uma publicação oficial.
        </span>
      </p>
    );
  }

  if (status === "disputed") {
    return (
      <p role="note" className="flex items-start gap-2 rounded-xl border border-destructive/40 px-3 py-2.5 text-sm">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <span>
          <span className="font-medium">Dados com divergência</span>
          {disputedFields.length > 0 && `: ${disputedFields.map((field) => FACT_FIELD_LABELS[field].toLowerCase()).join(", ")}`}.
          Confira na fonte antes de usar. Os dados em divergência não são usados nas sugestões.
        </span>
      </p>
    );
  }

  return (
    <p role="note" className="flex items-start gap-2 rounded-xl border border-accent/50 bg-card/70 px-3 py-2 text-sm">
      <Clock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      <span>
        <span className="font-medium">{status === "needs_update" ? "Dados em atualização" : "Dados em revisão"}</span>.{" "}
        {status === "needs_update"
          ? "Esta celebração foi revisada antes, mas precisa ser atualizada. Confira na fonte."
          : "As informações foram conferidas nas fontes abaixo, mas ainda não passaram por revisão humana."}
      </span>
    </p>
  );
}

/** Situação editorial em poucas palavras, para a faixa única da preparação da missa. */
const STATUS_SUMMARY = {
  reviewed: { label: "Celebração revisada", text: "pela equipe do Repertório Web; revisão editorial, não oficial.", icon: CircleCheck, tone: "text-primary" },
  pending_review: { label: "Dados em revisão", text: "conferidos nas fontes, ainda sem revisão humana.", icon: Clock, tone: "text-gold-strong" },
  needs_update: { label: "Dados em atualização", text: "revisados antes, mas precisam ser conferidos de novo.", icon: Clock, tone: "text-gold-strong" },
  disputed: { label: "Dados com divergência", text: "os itens em divergência não são usados nas sugestões.", icon: CircleAlert, tone: "text-destructive" },
} as const;

interface CelebrationNoticeProps {
  context: LiturgicalCelebrationContext;
  /** Grau de segurança das sugestões e os motivos, vindos da recomendação. */
  assurance?: "definitive" | "provisional";
  cautions?: string[];
}

/**
 * Um único aviso discreto, no lugar dos três da Etapa 2E.4A: a situação editorial fica sempre
 * à vista (com a marca "Sugestões provisórias" quando for o caso); os motivos, as leituras, os
 * temas e as fontes ficam no mesmo bloco, ao abrir. Nada é omitido, só agrupado.
 */
export function CelebrationNotice({ context, assurance = "definitive", cautions = [] }: CelebrationNoticeProps) {
  const status = STATUS_SUMMARY[context.review.status];
  const provisional = assurance === "provisional";
  return (
    <section aria-labelledby="celebracao-titulo" className="rounded-xl border bg-card/75 text-sm">
      <h2 id="celebracao-titulo" className="sr-only">
        {celebrationDisplayTitle(context)}
      </h2>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
          <status.icon className={cn("size-4 shrink-0", status.tone)} aria-hidden />
          <span className="font-semibold text-heading">{status.label}</span>
          <span className="min-w-0 text-muted-foreground">{status.text}</span>
          {provisional && (
            <span className="rounded-full border border-gold/50 bg-surface-alt px-2 py-0.5 text-xs font-medium text-heading">
              Sugestões provisórias
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-heading underline-offset-3 group-hover:underline">
            Detalhes, leituras e fontes
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
          </span>
        </summary>
        <div className="space-y-4 border-t px-3.5 pt-3 pb-4">
          <ReviewNotice context={context} />
          {provisional && cautions.length > 0 && (
            <div role="note">
              <p className="font-semibold text-heading">Por que as sugestões são provisórias</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {cautions.map((caution) => (
                  <li key={caution}>{caution}</li>
                ))}
              </ul>
            </div>
          )}
          <CelebrationDetails context={context} />
        </div>
      </details>
    </section>
  );
}

/** Contexto da celebração. Mostra só referências: o texto das leituras não é reproduzido. */
export function CelebrationCard({ context }: { context: LiturgicalCelebrationContext }) {
  return (
    <section aria-labelledby="celebracao-titulo" className="rounded-2xl border bg-card p-5 md:p-7">
      <p className="text-sm text-muted-foreground first-letter:uppercase">{formatLongDate(context.date)}</p>
      <h2 id="celebracao-titulo" className="mt-1 font-display text-2xl font-semibold tracking-tight text-balance md:text-3xl">
        {celebrationDisplayTitle(context)}
      </h2>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span>{CELEBRATION_RANK_LABELS[context.rank]}</span>
        <span aria-hidden className="text-muted-foreground">·</span>
        <span>{seasonLabel(context.season)}</span>
        <span aria-hidden className="text-muted-foreground">·</span>
        <span>
          Ano {context.lectionaryCycle.sunday}
          {context.lectionaryCycle.weekday && `, ciclo ferial ${context.lectionaryCycle.weekday}`}
        </span>
        {context.scope !== "universal" && (
          <>
            <span aria-hidden className="text-muted-foreground">·</span>
            <span>
              {CELEBRATION_SCOPE_LABELS[context.scope]}
              {context.diocese && ` (${context.diocese})`}
            </span>
          </>
        )}
      </p>

      <div className="mt-4">
        <ReviewNotice context={context} />
      </div>
      <CelebrationDetails context={context} />
    </section>
  );
}

function CelebrationDetails({ context }: { context: LiturgicalCelebrationContext }) {
  const unverified = READING_ROLES.filter((role) => context.unverifiedReadings.includes(role));
  const disputed = new Set(context.review.disputedFields);
  const inferred = context.provenance.filter((entry) => entry.status === "inference").map((entry) => entry.field);
  const sourceName = new Map(context.sources.map((source) => [source.id, source.provider]));

  return (
    <div>
      {context.liturgicalColor && (
        <p className="mt-4 text-sm">
          <span className="text-muted-foreground">Cor litúrgica: </span>
          <LiturgicalColorMark color={context.liturgicalColor.color} className="font-medium" />
          <span className="text-muted-foreground"> ({COLOR_BASIS[context.liturgicalColor.basis]})</span>
          {context.liturgicalColor.note && <span className="block text-muted-foreground">{context.liturgicalColor.note}</span>}
        </p>
      )}

      <h3 className="mt-6 text-sm font-semibold">Leituras</h3>
      <dl className="mt-2 divide-y rounded-xl border text-sm">
        {context.readings.map((reading) => (
          <div key={reading.role} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2">
            <dt className="text-muted-foreground">{READING_ROLE_LABELS[reading.role]}</dt>
            <dd className={cn("font-medium tabular-nums", disputed.has(reading.role) && "text-destructive")}>
              {reading.citation}
              {disputed.has(reading.role) && <span className="ml-1 font-normal">(em divergência)</span>}
            </dd>
          </div>
        ))}
        {unverified.map((role) => (
          <div key={role} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2">
            <dt className="text-muted-foreground">{READING_ROLE_LABELS[role]}</dt>
            <dd>
              Não conferido nesta base.{" "}
              <a
                href={externalLiturgyUrl(context.date)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-3"
              >
                Consultar a liturgia do dia
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Somente as referências: os textos litúrgicos não são reproduzidos aqui.
      </p>

      {context.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {context.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {context.biblicalThemes.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-semibold">Temas relacionados</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {context.biblicalThemes.map((theme) => (
              <li key={theme} className="rounded-full border px-3 py-1 text-sm">
                {themeLabel(theme)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Os temas são uma leitura editorial do Repertório Web a partir das leituras; não vêm das fontes.
          </p>
        </>
      )}

      {inferred.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Não confirmado em fonte do Brasil ou universal:{" "}
          {inferred.map((field) => FACT_FIELD_LABELS[field].toLowerCase()).join(", ")}. Esses dados seguem regras gerais do
          calendário.
        </p>
      )}

      <details className="mt-6 text-sm">
        <summary className="cursor-pointer rounded-md font-medium">Fontes e conferência</summary>
        <ul className="mt-3 space-y-3">
          {context.sources.map((source) => (
            <li key={source.id}>
              {source.referenceUrl ? (
                <a href={source.referenceUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-3">
                  {source.provider} — {source.documentTitle}
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              ) : (
                <span className="font-medium">
                  {source.provider} — {source.documentTitle}
                </span>
              )}
              <span className="block text-muted-foreground">
                {SOURCE_JURISDICTION_LABELS[source.jurisdiction]} · consultada em {formatShortDate(source.accessedAt)} ·{" "}
                {SOURCE_VERIFICATION_LABELS[source.verificationStatus].toLowerCase()}
                {source.edition && ` · ${source.edition}`}
              </span>
              <span className="block text-muted-foreground">
                Confirma: {source.scope.map((field) => FACT_FIELD_LABELS[field].toLowerCase()).join(", ")}.
              </span>
              {source.note && <span className="block text-muted-foreground">{source.note}</span>}
            </li>
          ))}
        </ul>
        <h4 className="mt-4 font-medium">De onde vem cada dado</h4>
        <dl className="mt-1 space-y-0.5 text-muted-foreground">
          {context.provenance.map((entry) => (
            <div key={entry.field} className="flex flex-wrap gap-x-2">
              <dt>{FACT_FIELD_LABELS[entry.field]}:</dt>
              <dd>
                {entry.status === "source"
                  ? entry.sourceIds.map((id) => sourceName.get(id) ?? id).join(", ")
                  : entry.status === "inference"
                    ? "regra geral, sem confirmação em fonte"
                    : "não conferido"}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-muted-foreground">
          Calendário do Rito Romano em uso no Brasil. Esta base é editorial e limitada a algumas datas: não é um calendário
          completo nem uma publicação oficial.
        </p>
      </details>
    </div>
  );
}
