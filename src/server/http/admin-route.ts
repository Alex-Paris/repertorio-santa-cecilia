import "server-only";

import { LibraryError } from "@/features/library/domain/library-errors";
import {
  createCatalogAdminService,
  isCatalogAdmin,
  type CatalogAdminService,
} from "@/server/catalog/catalog-service";

import { authenticatedRoute, type AuthenticatedRequest } from "./authenticated-route";

/**
 * Rotas da administração do catálogo: mesma sessão e checagem de origem das rotas privadas,
 * mais o papel administrativo, lido do banco a cada requisição.
 */
export function adminRoute<Params = object>(
  handler: (context: AuthenticatedRequest<Params> & { catalog: CatalogAdminService }) => Promise<Response>,
) {
  return authenticatedRoute<Params>(async (context) => {
    if (!(await isCatalogAdmin(context.userId))) {
      throw new LibraryError("catalog-admin-required");
    }
    return handler({ ...context, catalog: createCatalogAdminService(context.userId) });
  });
}
