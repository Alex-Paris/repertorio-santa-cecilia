import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { PageHero } from "@/components/layout/page-hero";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { MassPreparation, type MassSearchParams } from "@/features/liturgy/components/mass-preparation";

export const metadata: Metadata = {
  title: "Preparar missa",
  description: "Escolha a celebração, veja o contexto litúrgico e monte o repertório por momento da missa.",
};

interface PrepareMassPageProps {
  searchParams: Promise<MassSearchParams>;
}

const TITLE = "Preparar missa";
const SUBTITLE = "Escolha a data e a celebração, veja sugestões de cantos e monte o repertório da Santa Missa.";

async function Planner({ searchParams }: PrepareMassPageProps) {
  // Sem cache: uma revisão editorial ou uma despublicação vale na próxima leitura.
  await connection();
  // Sem data no endereço, a página já abre a próxima celebração; a data continua editável no topo.
  return <MassPreparation title={TITLE} subtitle={SUBTITLE} searchParams={await searchParams} defaultToNext />;
}

export default function PrepareMassPage({ searchParams }: PrepareMassPageProps) {
  return (
    <div data-layout="wide">
      <Suspense
        fallback={
          <PageHero title={TITLE} subtitle={SUBTITLE}>
            <ContentSkeleton />
          </PageHero>
        }
      >
        <Planner searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
