import { LibraryError } from "@/features/library/domain/library-errors";
import { getPublishedCatalogSong } from "@/server/catalog/catalog-service";
import { publicCatalogRoute } from "@/server/http/public-catalog-route";

export const GET = publicCatalogRoute<{ id: string }>(async ({ params }) => {
  const song = await getPublishedCatalogSong(params.id);
  if (!song) {
    throw new LibraryError("catalog-song-not-found");
  }
  return { song };
});
