import { cn } from "cn";
import { CalendarSearch, CloudOff, Film } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHero } from "@/components/layout/page-hero";
import { isValidEntityId } from "@/server/repositories/persistence";
import {
  getCelebrationSuggestions,
  getCelebrationsByDate,
  pickCelebration,
  searchCelebrations,
} from "@/server/liturgy/liturgy-service";

import {
  MASS_VARIANT_LABELS,
  externalLiturgyUrl,
  formatLongDate,
  isValidIsoDate,
  todayInBrazil,
  type CelebrationSummary,
  type LiturgicalCelebrationContext,
} from "../domain/calendar";
import type { CelebrationRecommendation } from "../domain/recommendation";
import { LITURGICAL_MOMENT_IDS, type LiturgicalMomentId } from "../domain/vocabulary";
import { CelebrationNotice } from "./celebration-card";
import { CelebrationChooser, MassExplore } from "./celebration-chooser";
import { CelebrationList } from "./celebration-picker";
import { MassPlanner } from "./mass-planner";

const UPCOMING = 6;

export type MassSearchParams = Record<string, string | string[] | undefined>;

async function settle<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

function parseMoment(value: unknown): LiturgicalMomentId | null {
  return LITURGICAL_MOMENT_IDS.find((moment) => moment === value) ?? null;
}

export async function upcoming(): Promise<CelebrationSummary[] | null> {
  const page = await settle(searchCelebrations({ from: todayInBrazil(), page: 1, pageSize: UPCOMING }));
  return page?.celebrations ?? null;
}

function CalendarUnavailable() {
  return (
    <div className="mt-6">
      <EmptyState
        icon={CloudOff}
        title="Calendário indisponível"
        description="Não foi possível consultar a base de celebrações agora. Isso não significa que a data não esteja cadastrada: tente novamente em instantes."
      />
    </div>
  );
}

/** Próximas celebrações com cobertura: uma página da busca, nunca o calendário inteiro. */
function Upcoming({ celebrations, title = "Próximas celebrações" }: { celebrations: CelebrationSummary[] | null; title?: string }) {
  if (!celebrations) {
    return null;
  }
  return (
    <div className="mx-auto max-w-3xl">
      <CelebrationList
        celebrations={celebrations}
        title={title}
        description="A base de celebrações é editorial e cobre poucas datas. As demais ainda não foram cadastradas."
        more={{ href: "/celebracoes", label: "Buscar celebrações por data, título ou tempo" }}
      />
    </div>
  );
}

function VariantPicker({ celebrations, selected }: { celebrations: LiturgicalCelebrationContext[]; selected: string }) {
  return (
    <nav aria-label="Celebrações desta data" className="mt-3">
      <p className="text-sm font-medium">Esta data tem mais de uma celebração ou formulário de missa:</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {celebrations.map((entry) => {
          const active = entry.celebrationId === selected;
          return (
            <li key={entry.celebrationId}>
              <Link
                href={`/preparar-missa?data=${entry.date}&celebracao=${encodeURIComponent(entry.celebrationId)}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full border px-4 py-1.5 text-sm font-medium",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                )}
              >
                {entry.massVariant === "principal" ? entry.title : `${entry.title} — ${MASS_VARIANT_LABELS[entry.massVariant]}`}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Reserva honesta para mídia: não há vídeo nem miniatura até existir um link autorizado. */
function VideoComingSoon() {
  return (
    <aside aria-labelledby="videos-em-breve" className="mt-6 flex items-start gap-2 text-sm text-muted-foreground">
      <Film className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
      <p>
        <span id="videos-em-breve" className="font-medium text-heading">
          Referências em vídeo (em breve):
        </span>{" "}
        aparecerão junto de cada música quando houver um link autorizado, sem reprodução automática.
      </p>
    </aside>
  );
}

interface MassPreparationProps {
  title: string;
  subtitle: string;
  searchParams: MassSearchParams;
  /** Sem data no endereço, abre a próxima celebração da base, com a data já escolhida no topo. */
  defaultToNext?: boolean;
}

/**
 * Preparação da missa, como na referência: topo com a escolha da celebração, sugestões por
 * momento, repertório em construção ao lado e atalhos de exploração. Sem banco, sem cobertura
 * ou sem data, cada caso tem o seu aviso; nada é estimado.
 */
export async function MassPreparation({ title, subtitle, searchParams, defaultToNext = false }: MassPreparationProps) {
  const rawDate = typeof searchParams.data === "string" ? searchParams.data : "";
  let date = rawDate;
  let requested = isValidEntityId(searchParams.celebracao) ? searchParams.celebracao : null;
  const next = await upcoming();

  if (!date && defaultToNext && next && next.length > 0) {
    date = next[0].date;
    requested = next[0].celebrationId;
  }

  if (!date || !isValidIsoDate(date)) {
    return (
      <>
        <PageHero title={title} subtitle={subtitle}>
          <CelebrationChooser error={rawDate ? "Informe uma data válida." : undefined} />
        </PageHero>
        {next === null ? <CalendarUnavailable /> : <Upcoming celebrations={next} />}
      </>
    );
  }

  const celebrations = await settle(getCelebrationsByDate(date));
  if (celebrations === null) {
    return (
      <>
        <PageHero title={title} subtitle={subtitle}>
          <CelebrationChooser date={date} />
        </PageHero>
        <CalendarUnavailable />
      </>
    );
  }

  if (celebrations.length === 0) {
    return (
      <>
        <PageHero title={title} subtitle={subtitle}>
          <CelebrationChooser date={date} />
        </PageHero>
        <div className="mx-auto mt-6 max-w-3xl">
          <EmptyState
            icon={CalendarSearch}
            title="Ainda não temos esta data"
            description={`Não há celebração cadastrada para ${formatLongDate(date)}. Nenhuma leitura é estimada: a base do Repertório Santa Cecília cobre apenas algumas datas.`}
            action={
              <ul className="flex flex-col items-center gap-2 text-sm">
                <li>
                  <a href={externalLiturgyUrl(date)} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-3">
                    Ver a liturgia do dia no Vatican News
                    <span className="sr-only"> (abre em nova aba)</span>
                  </a>
                </li>
                <li>
                  <Link href="/catalogo" className="font-medium underline underline-offset-3">
                    Buscar cantos por tempo litúrgico ou momento da missa
                  </Link>
                </li>
                <li>
                  <Link href="/celebracoes" className="font-medium underline underline-offset-3">
                    Buscar por celebração
                  </Link>
                </li>
              </ul>
            }
          />
        </div>
        <Upcoming celebrations={next} title="Celebrações disponíveis" />
      </>
    );
  }

  const context = pickCelebration(celebrations, requested) as LiturgicalCelebrationContext;
  const moment = parseMoment(searchParams.momento);
  const repertoireId = isValidEntityId(searchParams.repertorio) ? searchParams.repertorio : null;
  // Sem catálogo, a celebração continua em tela; só as sugestões ficam indisponíveis.
  const recommendation: CelebrationRecommendation | null = await settle(getCelebrationSuggestions(context, moment ?? undefined));

  return (
    <>
      <PageHero title={title} subtitle={subtitle}>
        <CelebrationChooser date={date} context={context} />
        {celebrations.length > 1 && <VariantPicker celebrations={celebrations} selected={context.celebrationId} />}
      </PageHero>
      <MassPlanner
        celebration={{
          date: context.date,
          celebrationId: context.celebrationId,
          title: context.massVariant === "principal" ? context.title : `${context.title} — ${MASS_VARIANT_LABELS[context.massVariant]}`,
          revision: context.revision,
          hasVariants: celebrations.length > 1,
        }}
        intro={<CelebrationNotice context={context} assurance={recommendation?.assurance} cautions={recommendation?.cautions} />}
        cautionsInIntro
        moments={recommendation?.moments ?? null}
        assurance={recommendation?.assurance}
        cautions={recommendation?.cautions}
        catalog={recommendation?.catalog}
        activeMoment={moment}
        repertoireId={repertoireId}
      >
        <MassExplore upcoming={next ?? []} selectedId={context.celebrationId} season={context.season} />
      </MassPlanner>
      <VideoComingSoon />
    </>
  );
}
