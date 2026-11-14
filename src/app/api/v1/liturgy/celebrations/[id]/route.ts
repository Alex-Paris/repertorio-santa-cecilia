import { LibraryError } from "@/features/library/domain/library-errors";
import { publicCatalogRoute } from "@/server/http/public-catalog-route";
import { getCelebrationById } from "@/server/liturgy/liturgy-service";

/** Uma celebração pelo identificador estável, com o estado editorial e as fontes. */
export const GET = publicCatalogRoute<{ id: string }>(async ({ params }) => {
  const celebration = await getCelebrationById(params.id);
  if (!celebration) {
    throw new LibraryError("celebration-not-found");
  }
  return { celebration };
});
