import type { Metadata } from "next";

import { RepertoireDetailScreen } from "@/features/repertoires/components/repertoire-detail-screen";

interface RepertoirePageProps {
  params: Promise<{ id: string }>;
}

// O conteúdo existe só no navegador do usuário; o servidor não sabe se o ID é válido.
export const metadata: Metadata = { title: "Repertório", robots: { index: false } };

export default async function RepertoirePage({ params }: RepertoirePageProps) {
  const { id } = await params;
  return <RepertoireDetailScreen repertoireId={id} />;
}
