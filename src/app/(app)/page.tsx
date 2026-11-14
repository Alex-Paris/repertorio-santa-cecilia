import { connection } from "next/server";
import { Suspense } from "react";

import { PageHero } from "@/components/layout/page-hero";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { MassPreparation } from "@/features/liturgy/components/mass-preparation";

const TITLE = "Qual missa você vai preparar?";
const SUBTITLE = "Escolha a data e a celebração, veja sugestões de músicas e monte o repertório da Santa Missa.";

/** O início já abre a próxima celebração da base, com as sugestões à vista. */
async function NextMass() {
  await connection();
  return <MassPreparation title={TITLE} subtitle={SUBTITLE} searchParams={{}} defaultToNext />;
}

export default function HomePage() {
  return (
    <div data-layout="wide">
      <Suspense
        fallback={
          <PageHero title={TITLE} subtitle={SUBTITLE}>
            <ContentSkeleton />
          </PageHero>
        }
      >
        <NextMass />
      </Suspense>
    </div>
  );
}
