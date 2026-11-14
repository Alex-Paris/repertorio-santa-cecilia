import { catalogSearchSchema } from "@/features/catalog/domain/catalog-song";
import { LibraryError } from "@/features/library/domain/library-errors";
import { searchCatalog } from "@/server/catalog/catalog-service";
import { publicCatalogRoute } from "@/server/http/public-catalog-route";

/** Busca pública: `q`, `page` e `pageSize`, todos validados e limitados. */
export const GET = publicCatalogRoute(async ({ request }) => {
  const { searchParams } = new URL(request.url);
  const result = catalogSearchSchema.safeParse(Object.fromEntries(searchParams));
  if (!result.success) {
    throw new LibraryError("invalid-data", "Parâmetros de busca inválidos.");
  }
  return searchCatalog(result.data);
});
