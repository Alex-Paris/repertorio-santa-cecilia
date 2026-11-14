import { cn } from "cn";
import { ArrowLeft, CloudOff, Music2, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHero } from "@/components/layout/page-hero";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { CatalogRepertoireDock } from "@/features/catalog/components/catalog-repertoire-dock";
import {
  CatalogExplore,
  CatalogQuickFilters,
  CatalogResults,
  CatalogSearchForm,
  FILTER_PARAMS,
  catalogHref,
  type CatalogLocation,
} from "@/features/catalog/components/catalog-results";
import { CatalogSongDetail } from "@/features/catalog/components/catalog-song-detail";
import {
  catalogSearchSchema,
  type CatalogFilters,
  type CatalogSearchResult,
} from "@/features/catalog/domain/catalog-song";
import type { CatalogSongView } from "@/features/library/domain/library";
import { getCatalogExploreFacets, getPublishedCatalogSong, searchCatalog } from "@/server/catalog/catalog-service";
import { isValidEntityId } from "@/server/repositories/persistence";

export const metadata: Metadata = { title: "Catálogo" };

interface CatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function loadResults(
  query: string,
  filters: CatalogFilters,
  page: number,
): Promise<{ status: "ready"; result: CatalogSearchResult } | { status: "failed" }> {
  try {
    return { status: "ready", result: await searchCatalog({ q: query, ...filters, page, pageSize: 12 }) };
  } catch {
    return { status: "failed" };
  }
}

async function loadSong(id: string): Promise<{ status: "ready"; song: CatalogSongView | null } | { status: "failed" }> {
  try {
    return { status: "ready", song: await getPublishedCatalogSong(id) };
  } catch {
    return { status: "failed" };
  }
}

/** Cada filtro é validado contra o seu vocabulário; um valor desconhecido é ignorado. */
function readFilters(raw: Record<string, string | string[] | undefined>): CatalogFilters {
  const filters: CatalogFilters = {};
  for (const key of Object.keys(FILTER_PARAMS) as (keyof CatalogFilters)[]) {
    const value = raw[FILTER_PARAMS[key]];
    const parsed = catalogSearchSchema.shape[key].safeParse(typeof value === "string" && value ? value : undefined);
    if (parsed.success && parsed.data) {
      Object.assign(filters, { [key]: parsed.data });
    }
  }
  return filters;
}

/** Zonas presas sob o cabeçalho, com rolagem própria só quando o conteúdo passa da tela. */
const ZONE =
  "min-w-0 rounded-2xl border bg-card/90 shadow-[0_1px_3px_rgb(71_45_27/0.06)] md:sticky md:top-[4.75rem] md:max-h-[calc(100dvh-5.5rem)] md:overflow-y-auto lg:top-[5.6rem] lg:max-h-[calc(100dvh-6.4rem)]";

async function CatalogContent({ searchParams }: CatalogPageProps) {
  // Sem `use cache`: uma despublicação vale na próxima consulta.
  await connection();
  const raw = await searchParams;
  const parsed = catalogSearchSchema.safeParse({
    q: typeof raw.q === "string" ? raw.q.slice(0, 100) : "",
    page: typeof raw.page === "string" ? raw.page : "1",
  });
  const query = parsed.success ? parsed.data.q.trim() : "";
  const page = parsed.success ? parsed.data.page : 1;
  const filters = readFilters(raw);
  const explicit = isValidEntityId(raw.musica) ? raw.musica : null;
  const repertoireId = isValidEntityId(raw.repertorio) ? raw.repertorio : null;
  const location: CatalogLocation = { query, filters, page, repertoireId };

  const [loaded, facets] = await Promise.all([
    loadResults(query, filters, page),
    // Os atalhos vêm das classificações publicadas; uma falha não esconde a busca.
    getCatalogExploreFacets().catch(() => null),
  ]);
  // Sem escolha, o painel central mostra a primeira música da lista (só no computador).
  const selectedId = explicit ?? (loaded.status === "ready" ? (loaded.result.songs[0]?.id ?? null) : null);
  const selected = selectedId ? await loadSong(selectedId) : null;

  return (
    <div className="grid grid-cols-1 gap-3 pb-24 md:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)_18.5rem] xl:pb-0 hd:grid-cols-[31.5rem_minmax(0,1fr)_19.5rem]">
      <section aria-labelledby="buscar-no-catalogo" className={cn(ZONE, "p-4 md:p-5", explicit && "hidden md:block")}>
        <h2 id="buscar-no-catalogo" className="mb-3 flex items-center gap-2.5 font-display text-[1.6rem] font-semibold text-heading">
          <Music2 className="size-7 text-gold" aria-hidden />
          Buscar no catálogo
        </h2>
        <CatalogSearchForm
          query={query}
          filters={filters}
          repertoireId={repertoireId}
          explore={facets && <CatalogExplore facets={facets} />}
        />
        <div className="mt-3">
          <CatalogQuickFilters location={location} facets={facets} />
        </div>
        <div className="mt-4 border-t border-gold/20 pt-3">
          {loaded.status === "ready" ? (
            <CatalogResults query={query} filters={filters} result={loaded.result} selectedId={selectedId} repertoireId={repertoireId} />
          ) : (
            <EmptyState
              icon={CloudOff}
              title="Catálogo indisponível"
              description="Não foi possível consultar o catálogo agora. Tente novamente em instantes."
            />
          )}
        </div>
      </section>

      <div className={cn("min-w-0", !explicit && "hidden md:block", "md:sticky md:top-[4.75rem] md:max-h-[calc(100dvh-5.5rem)] md:overflow-y-auto lg:top-[5.6rem] lg:max-h-[calc(100dvh-6.4rem)]")}>
        {explicit && (
          <Link
            href={catalogHref(location)}
            className="mb-2 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground md:hidden"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar à lista
          </Link>
        )}
        {selected === null ? (
          <div className={cn(ZONE, "p-6")}>
            <EmptyState icon={Music2} title="Nenhuma música aberta" description="Escolha uma música na lista para ver a letra, a cifra e a classificação." />
          </div>
        ) : selected.status === "failed" ? (
          <div className="rounded-2xl border bg-card p-6">
            <EmptyState icon={CloudOff} title="Catálogo indisponível" description="Não foi possível consultar o catálogo agora. Tente novamente em instantes." />
          </div>
        ) : selected.song ? (
          <CatalogSongDetail song={selected.song} headingLevel={2} currentRepertoire={{ repertoireId }} contained />
        ) : (
          <div className="rounded-2xl border bg-card p-6">
            <EmptyState icon={SearchX} title="Música não encontrada" description="Esta música não está disponível no catálogo." />
          </div>
        )}
      </div>

      <CatalogRepertoireDock repertoireId={repertoireId} locationHref={catalogHref({ ...location, selected: explicit })} addMore="search" />
    </div>
  );
}

export default function CatalogPage({ searchParams }: CatalogPageProps) {
  return (
    <div data-layout="wide">
      <PageHero
        align="start"
        title="Catálogo de músicas"
        subtitle="Encontre cantos litúrgicos, veja cifras, letras e a classificação de cada música."
      />
      <Suspense fallback={<ContentSkeleton />}>
        <CatalogContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
