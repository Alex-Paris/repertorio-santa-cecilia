import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
import {
  catalogSearchSchema,
  type CatalogFilters,
  type CatalogSearchResult,
} from "@/features/catalog/domain/catalog-song";
import { getCatalogExploreFacets, searchCatalog } from "@/server/catalog/catalog-service";
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

  // Links antigos continuam válidos; a leitura agora ocupa sua própria página.
  if (explicit) {
    const returnQuery = new URLSearchParams({ retorno: catalogHref(location) });
    if (repertoireId) returnQuery.set("repertorio", repertoireId);
    redirect(`/catalogo/${encodeURIComponent(explicit)}?${returnQuery}`);
  }
  const [loaded, facets] = await Promise.all([
    loadResults(query, filters, page),
    getCatalogExploreFacets().catch(() => null),
  ]);
  return (
    <div className="workspace-content">
      <section aria-labelledby="buscar-no-catalogo" className="workspace-body min-w-0" tabIndex={0} role="region" aria-label="Músicas do catálogo">
        <h2 id="buscar-no-catalogo" className="sr-only">Buscar no catálogo</h2>
        <CatalogSearchForm query={query} filters={filters} repertoireId={repertoireId}
          explore={facets && <CatalogExplore facets={facets} />}
          quickFilters={<CatalogQuickFilters location={location} facets={facets} />} />
        <div className="mt-6">
          {loaded.status === "ready" ? <CatalogResults query={query} filters={filters} result={loaded.result} repertoireId={repertoireId} />
            : <EmptyState icon={CloudOff} title="Catálogo indisponível" description="Não foi possível consultar o catálogo agora. Tente novamente em instantes." />}
        </div>
      </section>
      <CatalogRepertoireDock inline repertoireId={repertoireId} locationHref={catalogHref(location)} addMore="search" />
    </div>
  );
}

export default function CatalogPage({ searchParams }: CatalogPageProps) {
  return (
    <div data-layout="wide" className="music-workspace">
      <PageHero
        align="compact"
        title="Catálogo de músicas"
        subtitle="Encontre cantos litúrgicos, veja cifras, letras e a classificação de cada música."
      />
      <Suspense fallback={<ContentSkeleton />}>
        <CatalogContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
