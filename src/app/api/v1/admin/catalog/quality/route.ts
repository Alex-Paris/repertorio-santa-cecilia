import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { listCatalogQuality } from "@/server/catalog/catalog-service";

/** Pontos a revisar na classificação do catálogo. Somente leitura, só para a administração. */
export const GET = adminRoute(async () => jsonResponse(await listCatalogQuality()));
