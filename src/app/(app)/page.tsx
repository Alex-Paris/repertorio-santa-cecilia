import { connection } from "next/server";
import { Suspense } from "react";

import { PageHero } from "@/components/layout/page-hero";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { HomeMassStart, HomeStart } from "@/features/liturgy/components/home-start";
import { upcoming } from "@/features/liturgy/components/mass-preparation";

const TITLE = "Qual missa você vai preparar?";
const SUBTITLE = "Escolha a celebração e, na página da missa, veja sugestões de cantos por momento e monte o repertório.";

/**
 * O início escolhe a missa e leva à página dela; não repete as sugestões por momento nem o
 * repertório em construção, que ficam em /preparar-missa.
 */
async function Home() {
  // Sem cache: uma revisão editorial vale na próxima leitura.
  await connection();
  const next = await upcoming();
  return (
    <>
      <PageHero title={TITLE} subtitle={SUBTITLE}>
        <HomeMassStart next={next} />
      </PageHero>
      <HomeStart next={next} />
    </>
  );
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
        <Home />
      </Suspense>
    </div>
  );
}
