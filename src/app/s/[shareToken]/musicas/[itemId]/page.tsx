import { connection } from "next/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";

import { PublicSongScreen } from "@/features/sharing/components/public-song-screen";
import {
  ShareTemporarilyUnavailable,
  ShareUnavailable,
} from "@/features/sharing/components/share-unavailable";
import { loadPublicShare } from "@/server/sharing/public-share-reader";

interface PublicSongPageProps {
  params: Promise<{ shareToken: string; itemId: string }>;
}

// Sem `use cache`: uma revogação precisa valer já na próxima requisição.
async function PublicSongPageContent({ params }: PublicSongPageProps) {
  await connection();
  const { shareToken, itemId } = await params;

  const result = await loadPublicShare(shareToken);

  switch (result.status) {
    case "ready":
      return <PublicSongScreen token={shareToken} share={result.share} itemId={itemId} />;
    case "unavailable":
      return <ShareUnavailable />;
    case "failed":
      return <ShareTemporarilyUnavailable />;
  }
}

export default function PublicSongPage(props: PublicSongPageProps) {
  return <Suspense fallback={<PageSkeleton />}><PublicSongPageContent {...props} /></Suspense>;
}
