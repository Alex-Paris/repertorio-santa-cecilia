import { cn } from "cn";
import { ArrowRight, CalendarDays, Church, Crown, MoreHorizontal, Star } from "lucide-react";
import Link from "next/link";

import { LatinCross } from "@/components/brand/ornaments";
import { FormError } from "@/components/layout/form-error";
import { buttonVariants } from "@/components/ui/button";

import {
  CELEBRATION_RANK_LABELS,
  celebrationDisplayTitle,
  type CelebrationRank,
  type CelebrationSummary,
  type LiturgicalCelebrationContext,
} from "../domain/calendar";
import { LITURGICAL_SEASONS } from "../domain/vocabulary";
import { ReviewStatusBadge } from "./celebration-picker";
import { LiturgicalColorMark } from "./liturgical-color";
import { SEASON_ICONS, SeasonTag, TINTED, liturgicalTint } from "./liturgy-tags";

interface CelebrationChooserProps {
  /** Data no campo; a celebração mostrada é a desta data, já carregada. */
  date?: string;
  context?: LiturgicalCelebrationContext | null;
  error?: string;
}

function Fact({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="font-display text-[0.95rem] font-medium text-heading">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/**
 * Cartão "Qual missa": a data (formulário GET, funciona sem JavaScript) e, quando já há uma
 * celebração carregada, o título, o tempo, a cor e o estado editorial. Nada é estimado: sem
 * celebração na base, o cartão mostra só a escolha da data.
 */
export function CelebrationChooser({ date, context, error }: CelebrationChooserProps) {
  return (
    <form
      action="/preparar-missa"
      method="get"
      aria-label="Escolher a missa"
      className="surface-panel p-4 md:px-5 md:py-4"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-3 lg:flex lg:items-stretch lg:gap-0">
        <Fact label="Data da missa" className="lg:pr-5">
          <label htmlFor="data-da-celebracao" className="sr-only">
            Data da celebração
          </label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="data-da-celebracao"
              type="date"
              name="data"
              required
              defaultValue={date}
              aria-invalid={error ? true : undefined}
              className="h-11 w-full rounded-lg border border-input bg-field pr-2 pl-9 text-base font-medium lg:w-[12.5rem]"
            />
          </div>
        </Fact>

        {context ? (
          <>
            <span aria-hidden className="hidden w-px self-stretch bg-border lg:block" />
            <Fact label="Celebração selecionada" className="col-span-2 row-start-2 lg:flex-1 lg:px-5">
              <div className="flex items-start gap-2.5">
                <Church className="mt-0.5 size-6 shrink-0 text-gold" aria-hidden />
                <div className="min-w-0">
                  <p className="font-display text-[1.08rem] leading-snug font-semibold text-heading">
                    {celebrationDisplayTitle(context)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {CELEBRATION_RANK_LABELS[context.rank]} · Ano {context.lectionaryCycle.sunday}
                  </p>
                </div>
              </div>
            </Fact>
            <span aria-hidden className="hidden w-px self-stretch bg-border lg:block" />
            <div className="col-span-2 row-start-3 flex flex-wrap gap-x-8 gap-y-3 lg:contents">
              <Fact label="Tempo litúrgico" className="lg:px-5">
                <SeasonTag season={context.season} className="px-3 py-1 text-sm" />
              </Fact>
              <span aria-hidden className="hidden w-px self-stretch bg-border lg:block" />
              <Fact label="Cor" className="lg:px-5">
                {context.liturgicalColor ? (
                  <LiturgicalColorMark color={context.liturgicalColor.color} className="text-sm font-medium [&>span:first-child]:size-5" />
                ) : (
                  <span className="text-sm text-muted-foreground">Própria do dia</span>
                )}
              </Fact>
            </div>
          </>
        ) : (
          <p className="col-span-2 row-start-2 text-sm text-muted-foreground lg:flex-1 lg:self-center lg:px-5">
            Escolha a data: mostramos a celebração cadastrada, as referências das leituras e as sugestões de cantos por momento.
          </p>
        )}

        <button
          type="submit"
          className={cn(
            buttonVariants({ size: "lg" }),
            "col-start-2 row-start-1 h-11 shrink-0 gap-2 px-4 font-display text-[1.05rem] lg:ml-2 lg:h-12 lg:self-center lg:px-5",
          )}
        >
          <span className="sr-only lg:not-sr-only">Preparar missa</span>
          <span aria-hidden className="lg:hidden">Preparar</span>
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
      {error && (
        <div className="mt-2">
          <FormError message={error} />
        </div>
      )}
    </form>
  );
}

const TILE_DATE = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
const tileDate = (date: string) => TILE_DATE.format(new Date(`${date}T00:00:00.000Z`));

const RANK_ICONS: Partial<Record<CelebrationRank, typeof Crown>> = {
  solenidade: Crown,
  festa: Star,
  domingo: CalendarDays,
};

const TILE =
  "flex h-full min-h-[5.5rem] flex-col items-center justify-center gap-1 rounded-xl border bg-card px-2 py-2.5 text-center text-[0.8rem] leading-tight font-medium text-heading shadow-[0_1px_2px_rgb(71_45_27/0.06)] transition-colors hover:bg-surface-alt";

interface MassExploreProps {
  /** Próximas celebrações da base, as mesmas que existem de fato. */
  upcoming: CelebrationSummary[];
  /** Celebração e tempo em tela, destacados. */
  selectedId?: string;
  season?: LiturgicalCelebrationContext["season"];
  /** Complemento, para leitores de tela, do tempo destacado. */
  seasonNote?: string;
  /** Um grupo sob o outro, com mais largura para os nomes (página inicial). */
  stacked?: boolean;
  className?: string;
}

/** Atalhos compactos: celebrações que existem na base e tempos litúrgicos. */
export function MassExplore({ upcoming, selectedId, season, seasonNote = "tempo da celebração em tela", stacked = false, className }: MassExploreProps) {
  return (
    <div className={cn("grid gap-6 border-t border-gold/25 pt-5", !stacked && "lg:grid-cols-2 lg:gap-0", className)}>
      <section aria-labelledby="explorar-celebracao" className={cn(!stacked && "lg:border-r lg:border-gold/25 lg:pr-5")}>
        <h2 id="explorar-celebracao" className="flex items-center gap-2.5 font-display text-[1.25rem] font-semibold text-heading md:text-[1.45rem]">
          <CalendarDays className="size-6 text-gold" aria-hidden />
          Explorar por celebração
        </h2>
        <p className="sr-only">Próximas celebrações cadastradas na base editorial.</p>
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {upcoming.slice(0, 4).map((entry) => {
            const Icon = RANK_ICONS[entry.rank] ?? LatinCross;
            const current = entry.celebrationId === selectedId;
            return (
              <li key={entry.celebrationId}>
                <Link
                  href={`/preparar-missa?data=${entry.date}&celebracao=${encodeURIComponent(entry.celebrationId)}`}
                  aria-current={current ? "true" : undefined}
                  title={celebrationDisplayTitle(entry)}
                  className={cn(TILE, current && "border-primary ring-1 ring-primary")}
                >
                  <Icon className="size-5 text-gold-strong" aria-hidden />
                  <span className={cn("wrap-break-word", stacked ? "line-clamp-3" : "line-clamp-2")}>{celebrationDisplayTitle(entry)}</span>
                  <span className="text-[0.7rem] font-normal text-muted-foreground">{tileDate(entry.date)}</span>
                  <span className="sr-only">
                    , {CELEBRATION_RANK_LABELS[entry.rank]}. <ReviewStatusBadge status={entry.reviewStatus} />
                  </span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link href="/celebracoes" className={TILE}>
              <MoreHorizontal className="size-5 text-gold-strong" aria-hidden />
              Outras celebrações
            </Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="explorar-tempo" className={cn(!stacked && "lg:pl-5")}>
        <h2 id="explorar-tempo" className="flex items-center gap-2.5 font-display text-[1.25rem] font-semibold text-heading md:text-[1.45rem]">
          <LeafIcon />
          Explorar por tempo litúrgico
        </h2>
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {LITURGICAL_SEASONS.map((entry) => {
            const Icon = SEASON_ICONS[entry.id];
            const current = entry.id === season;
            return (
              <li key={entry.id}>
                <Link
                  href={`/celebracoes?tempo=${entry.id}`}
                  aria-current={current ? "true" : undefined}
                  style={current ? liturgicalTint(entry.color) : undefined}
                  className={cn(TILE, current && [TINTED, "ring-1 ring-[color-mix(in_oklab,var(--tag)_55%,transparent)]"])}
                >
                  <Icon className="size-5 text-gold-strong" aria-hidden />
                  {entry.label}
                  <span className="sr-only">: celebrações deste tempo{current ? ` (${seasonNote})` : ""}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function LeafIcon() {
  const Icon = SEASON_ICONS["tempo-comum"];
  return <Icon className="size-6 text-gold" aria-hidden />;
}
