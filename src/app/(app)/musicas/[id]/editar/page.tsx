import type { Metadata } from "next";

import {
  parseRepertoireContextQuery,
  type RepertoireContextQuery,
} from "@/features/repertoires/services/repertoire-reading-context";
import { SongFormScreen } from "@/features/songs/components/song-form-screen";

interface EditSongPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<RepertoireContextQuery>;
}

export const metadata: Metadata = { title: "Editar música", robots: { index: false } };

export default async function EditSongPage({ params, searchParams }: EditSongPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <SongFormScreen songId={id} contextReference={parseRepertoireContextQuery(query)} />;
}
