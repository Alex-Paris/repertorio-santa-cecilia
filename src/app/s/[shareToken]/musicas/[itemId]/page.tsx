import { connection } from "next/server";

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
export default async function PublicSongPage({ params }: PublicSongPageProps) {
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
