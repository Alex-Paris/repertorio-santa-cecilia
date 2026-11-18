import { connection } from "next/server";

import { SharePrintScreen } from "@/features/printing/components/print-screens";
import { parsePrintFormat } from "@/features/printing/domain/print-model";
import { ShareTemporarilyUnavailable, ShareUnavailable } from "@/features/sharing/components/share-unavailable";
import { loadPublicShare } from "@/server/sharing/public-share-reader";

interface PageProps {
  params: Promise<{ shareToken: string }>;
  searchParams: Promise<{ formato?: string | string[] }>;
}

/**
 * Impressão de um link público: o mesmo retrato e a mesma validação da página do link. Revogado
 * ou inválido, não há folha; só entra a cifra que o proprietário autorizou ao publicar.
 */
export default async function SharePrintPage({ params, searchParams }: PageProps) {
  await connection();
  const [{ shareToken }, query] = await Promise.all([params, searchParams]);
  const result = await loadPublicShare(shareToken);

  switch (result.status) {
    case "ready":
      return <SharePrintScreen token={shareToken} share={result.share} initialFormat={parsePrintFormat(query.formato, "lyrics")} />;
    case "unavailable":
      return <ShareUnavailable />;
    case "failed":
      return <ShareTemporarilyUnavailable />;
  }
}
