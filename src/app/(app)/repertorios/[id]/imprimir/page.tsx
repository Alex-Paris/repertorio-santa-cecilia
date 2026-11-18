import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { RepertoirePrintScreen } from "@/features/printing/components/print-screens";
import { parsePrintFormat } from "@/features/printing/domain/print-model";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ formato?: string | string[] }>;
}

// Os dados vêm da biblioteca da sessão, no navegador, como no detalhe do repertório.
export const metadata: Metadata = { title: "Imprimir repertório", robots: { index: false } };

async function Gate({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <RepertoirePrintScreen key={id} repertoireId={id} initialFormat={parsePrintFormat(query.formato, "lyrics")} />;
}

export default function RepertoirePrintPage(props: PageProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Gate {...props} />
    </Suspense>
  );
}
