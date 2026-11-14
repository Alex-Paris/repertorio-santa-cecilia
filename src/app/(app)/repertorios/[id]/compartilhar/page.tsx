import type { Metadata } from "next";

import { ShareRepertoireScreen } from "@/features/sharing/components/share-repertoire-screen";

interface SharePageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Compartilhar repertório", robots: { index: false } };

export default async function ShareRepertoirePage({ params }: SharePageProps) {
  const { id } = await params;
  return <ShareRepertoireScreen repertoireId={id} />;
}
