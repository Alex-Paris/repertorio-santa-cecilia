import { CloudOff, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { CatalogRepertoireDock } from "@/features/catalog/components/catalog-repertoire-dock";
import { CatalogSongScreen } from "@/features/catalog/components/catalog-song-screen";
import type { CatalogSongView } from "@/features/library/domain/library";
import { isValidIsoDate } from "@/features/liturgy/domain/calendar";
import {
  parseRepertoireContextQuery,
  type RepertoireContextQuery,
} from "@/features/repertoires/services/repertoire-reading-context";
import { SongDetailScreen } from "@/features/songs/components/song-detail-screen";
import { getPublishedCatalogSong } from "@/server/catalog/catalog-service";
import { isValidEntityId } from "@/server/repositories/persistence";

export const metadata: Metadata = { title: "Catálogo" };

interface CatalogSongPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<RepertoireContextQuery & { missa?: string | string[]; repertorio?: string | string[] }>;
}

async function load(id: string): Promise<{ status: "ready"; song: CatalogSongView | null } | { status: "failed" }> {
  try {
    return { status: "ready", song: await getPublishedCatalogSong(id) };
  } catch {
    return { status: "failed" };
  }
}

async function CatalogSongContent({ params, searchParams }: CatalogSongPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const context = parseRepertoireContextQuery(query);

  // No contexto de um repertório, a leitura usa o tom e as anotações do item, com login.
  if (context) {
    return <SongDetailScreen songId={id} source="catalog" contextReference={context} />;
  }

  await connection();
  const loaded = await load(id);

  if (loaded.status === "failed") {
    return (
      <EmptyState
        icon={CloudOff}
        title="Catálogo indisponível"
        description="Não foi possível consultar o catálogo agora. Tente novamente em instantes."
      />
    );
  }
  // Rascunhos e músicas despublicadas não existem para o público.
  // Vindo da preparação de uma missa, o caminho de volta leva à mesma celebração.
  const massDate = isValidIsoDate(query.missa) ? query.missa : null;
  const repertoireId = isValidEntityId(query.repertorio) ? query.repertorio : null;
  return loaded.song ? (
    // Sem Hero: o espaço sob o cabeçalho vem da regra comum do layout (`--page-top`).
    <div data-layout="wide">
      <div className="grid gap-4 pb-24 xl:grid-cols-[minmax(0,1fr)_19.5rem] xl:pb-0">
        <CatalogSongScreen
          song={loaded.song}
          back={massDate ? { href: `/preparar-missa?data=${massDate}`, label: "Preparar missa" } : undefined}
          currentRepertoire={{ repertoireId }}
        />
        <CatalogRepertoireDock repertoireId={repertoireId} locationHref={`/catalogo/${encodeURIComponent(id)}`} addMore="catalog" />
      </div>
    </div>
  ) : (
    <EmptyState icon={SearchX} title="Música não encontrada" description="Esta música não está disponível no catálogo." />
  );
}

export default function CatalogSongPage(props: CatalogSongPageProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CatalogSongContent {...props} />
    </Suspense>
  );
}
