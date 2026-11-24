import { cn } from "cn";
import { ArrowRight, CalendarDays, Church, CloudOff, ListMusic } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { HomePersonal } from "@/features/library/components/home-personal";

import {
  CELEBRATION_RANK_LABELS,
  celebrationDisplayTitle,
  formatLongDate,
  type CelebrationSummary,
} from "../domain/calendar";
import { MassExplore } from "./celebration-chooser";
import { LiturgicalColorMark } from "./liturgical-color";
import { SeasonTag } from "./liturgy-tags";

const CARD = "surface-panel";

export function massHref(entry: Pick<CelebrationSummary, "date" | "celebrationId">): string {
  return `/preparar-missa?data=${entry.date}&celebracao=${encodeURIComponent(entry.celebrationId)}`;
}

/** Outra data: formulário GET para a página da missa, que funciona sem JavaScript. */
function OtherDate({ highlighted }: { highlighted: boolean }) {
  return (
    <form action="/preparar-missa" method="get" aria-label="Escolher outra data" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <label htmlFor="data-da-missa" className="w-full font-display text-[0.95rem] font-medium text-heading sm:w-auto">
        {highlighted ? "Data da missa" : "Outra data"}
      </label>
      <div className="flex min-w-0 flex-1 gap-2 sm:flex-none">
        <div className="relative min-w-0 flex-1 sm:flex-none">
          <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="data-da-missa"
            type="date"
            name="data"
            required
            className="h-11 w-full rounded-lg border border-input bg-field pr-2 pl-9 text-base font-medium sm:w-[12.5rem]"
          />
        </div>
        <button
          type="submit"
          className={cn(buttonVariants({ variant: highlighted ? "default" : "outline", size: "lg" }), "h-10 shrink-0 px-4")}
        >
          {highlighted ? "Preparar missa" : "Abrir"}
        </button>
      </div>
    </form>
  );
}

/**
 * Cartão do início: a próxima celebração da base em destaque, com um único botão para preparar a
 * missa, e a escolha de outra data logo abaixo. As sugestões por momento ficam só na página da
 * missa; aqui nada é estimado e, sem celebração na base, resta a escolha da data.
 */
export function HomeMassStart({ next }: { next: CelebrationSummary[] | null }) {
  const first = next?.[0];

  if (!first) {
    return (
      <div className={cn(CARD, "p-4 md:px-5")}>
        <OtherDate highlighted />
        <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
          {next === null && <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {next === null
            ? "Não foi possível consultar a base de celebrações agora. Tente novamente em instantes."
            : "Nenhuma celebração cadastrada a partir de hoje. A base é editorial e cobre poucas datas: escolha uma data ou busque cantos no catálogo."}
        </p>
      </div>
    );
  }

  const title = celebrationDisplayTitle(first);
  return (
    <section aria-labelledby="proxima-celebracao" className={cn(CARD, "overflow-hidden")}>
      <div className="flex flex-col gap-4 p-4 md:px-5 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Church className="mt-1 size-7 shrink-0 text-gold" aria-hidden />
          <div className="min-w-0">
            <h2 id="proxima-celebracao" className="text-[0.78rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Próxima celebração
            </h2>
            <p className="mt-0.5 font-display text-[1.2rem] leading-snug font-semibold text-balance text-heading md:text-[1.35rem]">
              {title}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground first-letter:uppercase">
              {formatLongDate(first.date)} · {CELEBRATION_RANK_LABELS[first.rank]}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <SeasonTag season={first.season} />
              {first.color && (
                <span className="text-sm">
                  <span className="sr-only">Cor litúrgica: </span>
                  <LiturgicalColorMark color={first.color} className="font-medium" />
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          href={massHref(first)}
          className={cn(buttonVariants({ size: "lg" }), "h-12 shrink-0 gap-2 self-stretch px-5 font-display text-[1.05rem] lg:self-center")}
        >
          Preparar esta missa
          <span className="sr-only">: {title}</span>
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="border-t bg-surface-alt/60 px-4 py-3 md:px-5">
        <OtherDate highlighted={false} />
      </div>
    </section>
  );
}

/**
 * Página inicial: a escolha da missa e os atalhos de exploração, com os repertórios da
 * conta ao lado. Sugestões por momento e o repertório em construção ficam na página da missa.
 */
export function HomeStart({ next }: { next: CelebrationSummary[] | null }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-8 md:mt-8 xl:grid-cols-[minmax(0,1fr)_25rem] xl:gap-6 hd:grid-cols-[minmax(0,1fr)_27rem]">
      <MassExplore upcoming={next ?? []} season={next?.[0]?.season} seasonNote="tempo da próxima celebração" stacked className="content-start border-t-0 pt-0" />
      <section aria-labelledby="seus-repertorios" className="rounded-2xl border bg-card">
        <h2
          id="seus-repertorios"
          className="flex items-center gap-2.5 border-b px-4 py-3 font-display text-[1.25rem] font-semibold text-heading md:px-5"
        >
          <ListMusic className="size-5 text-gold" aria-hidden />
          Seus repertórios
        </h2>
        <div className="p-4 md:px-5">
          <HomePersonal />
        </div>
      </section>
    </div>
  );
}
