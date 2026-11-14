import { connection } from "next/server";

import { PublicShareView } from "@/features/sharing/components/public-share-view";
import {
  ShareTemporarilyUnavailable,
  ShareUnavailable,
} from "@/features/sharing/components/share-unavailable";
import { loadPublicShare } from "@/server/sharing/public-share-reader";

interface PublicSharePageProps {
  params: Promise<{ shareToken: string }>;
}

// Sem `use cache`: uma revogação precisa valer já na próxima requisição.
export default async function PublicSharePage({ params }: PublicSharePageProps) {
  await connection();
  const { shareToken } = await params;

  const result = await loadPublicShare(shareToken);

  switch (result.status) {
    case "ready":
      return <PublicShareView token={shareToken} share={result.share} />;
    case "unavailable":
      return <ShareUnavailable />;
    case "failed":
      return <ShareTemporarilyUnavailable />;
  }
}
