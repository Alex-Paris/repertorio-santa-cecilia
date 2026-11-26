import { connection } from "next/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";

import { SharePrintScreen } from "@/features/printing/components/print-screens";
import { parsePrintFormat, parseSemitones } from "@/features/printing/domain/print-model";
import { ShareTemporarilyUnavailable, ShareUnavailable } from "@/features/sharing/components/share-unavailable";
import { loadPublicShare } from "@/server/sharing/public-share-reader";

interface PageProps {
  params: Promise<{ shareToken: string }>;
  searchParams: Promise<{ formato?: string | string[]; item?: string | string[]; tom?: string | string[] }>;
}

/**
 * Impressão de um link público: o mesmo retrato e a mesma validação da página do link. Revogado
 * ou inválido, não há folha; só entra a cifra que o proprietário autorizou ao publicar.
 */
async function SharePrintPageContent({ params, searchParams }: PageProps) {
  await connection();
  const [{ shareToken }, query] = await Promise.all([params, searchParams]);
  const result = await loadPublicShare(shareToken);

  switch (result.status) {
    case "ready":
      if (query.item !== undefined && (typeof query.item !== "string" || !result.share.items.some((item) => item.id === query.item))) return <ShareUnavailable />;
      return <SharePrintScreen token={shareToken} share={result.share} itemId={typeof query.item === "string" ? query.item : undefined}
        semitones={query.tom === undefined ? undefined : parseSemitones(query.tom)} initialFormat={parsePrintFormat(query.formato, "lyrics")} />;
    case "unavailable":
      return <ShareUnavailable />;
    case "failed":
      return <ShareTemporarilyUnavailable />;
  }
}

export default function SharePrintPage(props: PageProps) {
  return <Suspense fallback={<PageSkeleton />}><SharePrintPageContent {...props} /></Suspense>;
}
