import { CloudOff, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { CatalogSongPrintScreen } from "@/features/printing/components/print-screens";
import { parsePrintFormat, parseSemitones } from "@/features/printing/domain/print-model";
import { getPublishedCatalogSong } from "@/server/catalog/catalog-service";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modo?: string | string[]; tom?: string | string[] }>;
}

export const metadata: Metadata = { title: "Imprimir música do catálogo", robots: { index: false } };

/**
 * Mesma leitura pública da página da música: só publicadas, e a cifra só com permissão de
 * exibição. Imprimir não abre nada além do que já está na tela.
 */
async function Gate({ params, searchParams }: PageProps) {
  await connection();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  let song;
  try {
    song = await getPublishedCatalogSong(id);
  } catch {
    return <EmptyState icon={CloudOff} title="Catálogo indisponível" description="Não foi possível consultar o catálogo agora. Tente novamente em instantes." />;
  }
  if (!song) {
    return <EmptyState icon={SearchX} title="Música não encontrada" description="Esta música não está disponível no catálogo." />;
  }
  return (
    <CatalogSongPrintScreen
      key={id}
      song={song}
      initialFormat={parsePrintFormat(query.modo, "chords")}
      semitones={parseSemitones(query.tom)}
    />
  );
}

export default function CatalogSongPrintPage(props: PageProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Gate {...props} />
    </Suspense>
  );
}
