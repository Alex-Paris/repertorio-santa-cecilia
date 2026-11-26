import { connection } from "next/server";
import { Suspense } from "react";

import { HomeHero } from "@/components/layout/home-hero";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { HomeStart } from "@/features/liturgy/components/home-start";
import { upcoming } from "@/features/liturgy/components/mass-preparation";

/**
 * O início escolhe a missa e leva à página dela; não repete as sugestões por momento nem o
 * repertório em construção, que ficam em /preparar-missa.
 */
async function Home() {
  // Sem cache: uma revisão editorial vale na próxima leitura.
  await connection();
  const next = await upcoming();
  return <HomeStart next={next} />;
}

export default function HomePage() {
  return (
    <div data-layout="wide">
      <HomeHero />
      <Suspense fallback={<ContentSkeleton />}>
        <Home />
      </Suspense>
    </div>
  );
}
