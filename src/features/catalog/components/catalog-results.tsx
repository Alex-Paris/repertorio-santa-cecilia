import { cn } from "cn";
import { Check, ChevronRight, FileMusic, Link2, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { MOMENT_ICONS, MomentTag, SEASON_ICONS, SeasonTag } from "@/features/liturgy/components/liturgy-tags";
import type { LiturgicalMomentId, LiturgicalSeasonId } from "@/features/liturgy/domain/vocabulary";
import {
  BIBLICAL_THEMES,
  LITURGICAL_CELEBRATIONS,
  LITURGICAL_MOMENTS,
  LITURGICAL_SEASONS,
  celebrationLabel,
  momentLabel,
  seasonLabel,
  themeLabel,
} from "@/features/liturgy/domain/vocabulary";

import type { CatalogFilters, CatalogSearchResult } from "../domain/catalog-song";

/** Nomes dos filtros no endereço da página, em português. */
export const FILTER_PARAMS = {
  moment: "momento",
  season: "tempo",
  celebration: "celebracao",
  theme: "tema",
} as const satisfies Record<keyof CatalogFilters, string>;

/** Estado da página do catálogo, todo no endereço: busca, filtros, página, música e repertório. */
export interface CatalogLocation {
  query: string;
  filters: CatalogFilters;
  page?: number;
  /** Música aberta no painel central. */
  selected?: string | null;
  /** Repertório atual do painel da direita. */
  repertoireId?: string | null;
}

export function catalogHref(location: CatalogLocation): string {
  const params = new URLSearchParams();
  if (location.query) {
    params.set("q", location.query);
  }
  for (const key of Object.keys(FILTER_PARAMS) as (keyof CatalogFilters)[]) {
    const value = location.filters[key];
    if (value) {
      params.set(FILTER_PARAMS[key], value);
    }
  }
  if (location.page && location.page > 1) {
    params.set("page", String(location.page));
  }
  if (location.selected) {
    params.set("musica", location.selected);
  }
  if (location.repertoireId) {
    params.set("repertorio", location.repertoireId);
  }
  const search = params.toString();
  return search ? `/catalogo?${search}` : "/catalogo";
}

/** Filtros ativos por extenso, para a contagem de resultados e os estados vazios. */
function describeFilters(filters: CatalogFilters): string[] {
  return [
    filters.moment && momentLabel(filters.moment),
    filters.season && seasonLabel(filters.season),
    filters.celebration && celebrationLabel(filters.celebration),
    filters.theme && themeLabel(filters.theme),
  ].filter((label): label is string => Boolean(label));
}

interface FilterSelectProps {
  name: string;
  label: string;
  value: string | undefined;
  options: readonly { id: string; label: string }[];
}

function FilterSelect({ name, label, value, options }: FilterSelectProps) {
  const id = `filtro-${name}`;
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={value ?? ""}
        className="h-10 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 text-base md:text-sm"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface CatalogSearchFormProps {
  query: string;
  filters?: CatalogFilters;
  repertoireId?: string | null;
  /** Caminhos de exploração, dentro do painel de filtros. */
  explore?: React.ReactNode;
  /** Atalhos de um toque, na mesma faixa do botão de filtros. */
  quickFilters?: React.ReactNode;
}

/**
 * Busca da zona esquerda. Formulário GET comum: funciona com teclado e sem JavaScript, e a
 * busca fica no endereço. Os quatro filtros litúrgicos ficam num painel que se abre.
 */
export function CatalogSearchForm({ query, filters = {}, repertoireId, explore, quickFilters }: CatalogSearchFormProps) {
  const activeCount = describeFilters(filters).length;
  return (
    <form action="/catalogo" role="search" className="space-y-3">
      {repertoireId && <input type="hidden" name="repertorio" value={repertoireId} />}
      <div className="relative">
        <label htmlFor="catalogo-busca" className="sr-only">
          Buscar no catálogo por título ou artista
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id="catalogo-busca"
          name="q"
          type="search"
          defaultValue={query}
          maxLength={100}
          placeholder="Título ou autoria"
          className="h-12 w-full min-w-0 rounded-xl border border-input bg-background/70 pr-24 pl-11 text-base"
        />
        <button type="submit" className={cn(buttonVariants({ size: "sm" }), "absolute top-1/2 right-1.5 h-9 -translate-y-1/2 px-3")}>
          Buscar
        </button>
      </div>
      <div className="flex flex-wrap items-start gap-2">
      <details className="group shrink-0 rounded-xl border border-transparent open:basis-full open:border-border open:bg-background/50 open:p-3">
        <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-full border border-gold/40 bg-card px-3 text-sm font-medium whitespace-nowrap text-heading [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="size-4 text-gold-strong" aria-hidden />
          Filtros litúrgicos{activeCount > 0 && ` (${activeCount})`}
        </summary>
        <fieldset className="mt-3 grid grid-cols-2 gap-2">
          <legend className="sr-only">Filtros litúrgicos</legend>
          <FilterSelect name={FILTER_PARAMS.moment} label="Momento da missa" value={filters.moment} options={LITURGICAL_MOMENTS} />
          <FilterSelect name={FILTER_PARAMS.season} label="Tempo litúrgico" value={filters.season} options={LITURGICAL_SEASONS} />
          <FilterSelect name={FILTER_PARAMS.celebration} label="Celebração" value={filters.celebration} options={LITURGICAL_CELEBRATIONS} />
          <FilterSelect name={FILTER_PARAMS.theme} label="Tema" value={filters.theme} options={BIBLICAL_THEMES} />
        </fieldset>
        <button type="submit" className={cn(buttonVariants({ size: "lg" }), "mt-3 h-10 px-4")}>
          Aplicar filtros
        </button>
        {explore && <div className="mt-4">{explore}</div>}
      </details>
      {quickFilters && <div className="min-w-0 flex-1">{quickFilters}</div>}
      </div>
    </form>
  );
}

interface QuickFiltersProps {
  location: CatalogLocation;
  /** Classificações existentes no catálogo publicado, com a contagem. */
  facets: ExploreFacets | null;
}

/**
 * Atalhos de um toque: os filtros ativos (para retirar) e as classificações mais frequentes do
 * catálogo publicado. Nada aparece que não exista de fato.
 */
export function CatalogQuickFilters({ location, facets }: QuickFiltersProps) {
  const { filters } = location;
  const chips: { key: keyof CatalogFilters; id: string; label: string; active: boolean }[] = [];
  const add = (key: keyof CatalogFilters, id: string, label: string) => {
    if (!chips.some((chip) => chip.key === key && chip.id === id)) {
      chips.push({ key, id, label, active: filters[key] === id });
    }
  };
  if (filters.moment) add("moment", filters.moment, momentLabel(filters.moment));
  if (filters.season) add("season", filters.season, seasonLabel(filters.season));
  if (filters.celebration) add("celebration", filters.celebration, celebrationLabel(filters.celebration));
  if (filters.theme) add("theme", filters.theme, themeLabel(filters.theme));
  if (facets) {
    facets.moments.slice(0, 2).forEach((entry) => add("moment", entry.id, momentLabel(entry.id as never)));
    facets.seasons.slice(0, 1).forEach((entry) => add("season", entry.id, seasonLabel(entry.id as never)));
    facets.celebrations.slice(0, 1).forEach((entry) => add("celebration", entry.id, celebrationLabel(entry.id as never)));
    facets.themes.slice(0, 1).forEach((entry) => add("theme", entry.id, themeLabel(entry.id as never)));
  }
  if (chips.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Filtros rápidos" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {chips.map((chip) => {
        const next = { ...filters, [chip.key]: chip.active ? undefined : chip.id };
        return (
          <li key={`${chip.key}-${chip.id}`} className="shrink-0">
            <Link
              href={catalogHref({ ...location, filters: next, page: 1, selected: null })}
              aria-pressed={chip.active}
              aria-label={chip.active ? `Retirar o filtro ${chip.label}` : `Filtrar por ${chip.label}`}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[0.82rem] font-medium whitespace-nowrap transition-colors",
                chip.active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-gold/40 bg-card text-heading hover:bg-surface-alt",
              )}
            >
              {chip.active ? <Check className="size-3.5" aria-hidden /> : <ChipIcon chip={chip} />}
              {chip.label}
              {chip.active && <X className="size-3.5" aria-hidden />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Ícone de momento ou tempo, como nas etiquetas; celebrações e temas ficam só com o nome. */
function ChipIcon({ chip }: { chip: { key: keyof CatalogFilters; id: string } }) {
  const Icon =
    chip.key === "moment"
      ? MOMENT_ICONS[chip.id as LiturgicalMomentId]
      : chip.key === "season"
        ? SEASON_ICONS[chip.id as LiturgicalSeasonId]
        : null;
  return Icon ? <Icon className="size-3.5 text-gold-strong" aria-hidden /> : null;
}

interface CatalogResultsProps {
  query: string;
  filters?: CatalogFilters;
  result: CatalogSearchResult;
  /** Música aberta no painel central, destacada na lista. */
  selectedId?: string | null;
  repertoireId?: string | null;
}

function ChordStatus({ song }: { song: CatalogSearchResult["songs"][number] }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {song.contentType === "external-link" ? (
        <>
          <Link2 className="size-3" aria-hidden />
          Consultar cifra na fonte original
        </>
      ) : song.hasChordPro ? (
        <>
          <FileMusic className="size-3" aria-hidden />
          Cifra disponível
        </>
      ) : (
        "Cifra ainda não disponível"
      )}
    </span>
  );
}

/** Lista compacta da zona esquerda. Escolher uma música abre o painel central, sem sair da lista. */
export function CatalogResults({ query, filters = {}, result, selectedId, repertoireId }: CatalogResultsProps) {
  const active = describeFilters(filters);
  const location: CatalogLocation = { query, filters, page: result.page, repertoireId };

  if (result.songs.length === 0) {
    const filtered = Boolean(query) || active.length > 0;
    return (
      <EmptyState
        icon={Search}
        title={filtered ? "Nenhuma música encontrada" : "O catálogo ainda está vazio"}
        description={
          active.length > 0
            ? `Nenhuma música publicada combina ${query ? `“${query}” com ` : ""}${active.join(", ")}. Retire um dos filtros para ampliar a busca.`
            : query
              ? "Tente outras palavras. A busca encontra o começo das palavras do título ou do artista."
              : "Ainda não há músicas publicadas no catálogo."
        }
        action={
          filtered ? (
            <Link href={catalogHref({ query: "", filters: {}, repertoireId })} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              Limpar busca e filtros
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-[1.15rem] font-semibold text-heading">
          Músicas encontradas <span className="font-sans text-sm font-normal text-muted-foreground tabular-nums">({result.total})</span>
        </h2>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {result.total === 1 ? "1 música" : `${result.total} músicas`}
          {query && ` para “${query}”`}
          {active.length > 0 && ` · ${active.join(" · ")}`}
          {active.length > 0 && (
            <>
              {" "}
              <Link href={catalogHref({ query, filters: {}, repertoireId })} className="font-medium underline underline-offset-3">
                Limpar filtros
              </Link>
            </>
          )}
        </p>
      </div>
      {/* Lista compacta: uma linha de título e autoria, outra de classificação e cifra. */}
      <ul className="mt-2 divide-y overflow-hidden rounded-xl border bg-card">
        {result.songs.map((song) => {
          const current = song.id === selectedId;
          return (
            <li key={song.id}>
              <Link
                href={catalogHref({ ...location, selected: song.id })}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-alt/60",
                  current && "bg-surface-alt shadow-[inset_3px_0_0_var(--gold)]",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-display text-[1rem] leading-snug font-semibold wrap-break-word text-heading">{song.title}</span>
                    <span className="text-[0.8rem] text-muted-foreground wrap-break-word">{song.artist || "Autoria não informada"}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {((song.moments && song.moments.length > 0) || (song.seasons && song.seasons.length > 0)) && (
                      <span className="sr-only">Classificação: </span>
                    )}
                    {song.moments?.slice(0, 2).map((moment) => <MomentTag key={moment} moment={moment} className="py-0 text-[0.72rem]" />)}
                    {song.seasons?.slice(0, 1).map((season) => <SeasonTag key={season} season={season} className="py-0 text-[0.72rem]" />)}
                    <ChordStatus song={song} />
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className={cn("size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5", current && "text-gold-strong")}
                />
              </Link>
            </li>
          );
        })}
      </ul>
      {result.totalPages > 1 && (
        <nav aria-label="Páginas do catálogo" className="mt-3 flex items-center justify-between gap-2 text-sm">
          {result.page > 1 ? (
            <Link href={catalogHref({ ...location, page: result.page - 1 })} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground tabular-nums">
            Página {result.page} de {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={catalogHref({ ...location, page: result.page + 1 })} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              Próxima
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

export interface ExploreFacets {
  moments: { id: string; count: number }[];
  seasons: { id: string; count: number }[];
  celebrations: { id: string; count: number }[];
  themes: { id: string; count: number }[];
}

function ExploreGroup({
  title,
  param,
  entries,
  label,
}: {
  title: string;
  param: string;
  entries: { id: string; count: number }[];
  label: (id: string) => string;
}) {
  if (entries.length === 0) {
    return null;
  }
  const headingId = `explorar-${param}`;
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="text-sm font-semibold">
        {title}
      </h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link
              href={`/catalogo?${param}=${encodeURIComponent(entry.id)}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium hover:bg-muted"
            >
              {label(entry.id)}
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                <span className="sr-only">, </span>
                {entry.count === 1 ? "1 música" : `${entry.count} músicas`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Caminhos de exploração, só com classificações que existem no catálogo publicado. */
export function CatalogExplore({ facets }: { facets: ExploreFacets }) {
  const empty = Object.values(facets).every((list) => list.length === 0);
  if (empty) {
    return null;
  }
  return (
    <section aria-labelledby="explorar" className="mb-8 space-y-5 rounded-2xl border bg-card/50 p-4 md:p-5">
      <div>
        <h2 id="explorar" className="font-display text-xl font-semibold tracking-tight">
          Explorar
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pela classificação editorial do Repertório Web. Não é uma indicação oficial da Igreja.
        </p>
      </div>
      <ExploreGroup title="Momento da missa" param={FILTER_PARAMS.moment} entries={facets.moments} label={momentLabel} />
      <ExploreGroup title="Tempo litúrgico" param={FILTER_PARAMS.season} entries={facets.seasons} label={seasonLabel} />
      <ExploreGroup title="Celebrações" param={FILTER_PARAMS.celebration} entries={facets.celebrations} label={celebrationLabel} />
      <ExploreGroup title="Temas" param={FILTER_PARAMS.theme} entries={facets.themes} label={themeLabel} />
    </section>
  );
}

