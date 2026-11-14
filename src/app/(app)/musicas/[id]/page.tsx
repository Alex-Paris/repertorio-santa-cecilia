import type { Metadata } from "next";

import {
  parseRepertoireContextQuery,
  type RepertoireContextQuery,
} from "@/features/repertoires/services/repertoire-reading-context";
import { SongDetailScreen } from "@/features/songs/components/song-detail-screen";

interface SongPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<RepertoireContextQuery>;
}

// O conteúdo existe só no navegador do usuário; o servidor não sabe se o ID é válido.
export const metadata: Metadata = { title: "Música", robots: { index: false } };

export default async function SongPage({ params, searchParams }: SongPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  return <SongDetailScreen songId={id} contextReference={parseRepertoireContextQuery(query)} />;
}
