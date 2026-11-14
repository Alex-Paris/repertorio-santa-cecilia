import { isValidIsoDate } from "@/features/liturgy/domain/calendar";
import { celebrationQuerySchema } from "@/features/liturgy/domain/celebration-query";
import { LibraryError } from "@/features/library/domain/library-errors";
import { publicCatalogRoute } from "@/server/http/public-catalog-route";
import { getCelebrationsByDate, searchCelebrations } from "@/server/liturgy/liturgy-service";

/**
 * Com `date`: as celebrações da data (`celebration` é a primeira, `celebrations` traz as
 * variantes), ou 404 sem cobertura. Sem `date`: busca paginada por período, título, tempo
 * e situação editorial. Nenhuma leitura é estimada e nada interno da administração sai daqui.
 */
export const GET = publicCatalogRoute(async ({ request }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);

  if ("date" in params) {
    if (Object.keys(params).length !== 1 || !isValidIsoDate(params.date)) {
      throw new LibraryError("invalid-data", "Informe a data no formato AAAA-MM-DD.");
    }
    const celebrations = await getCelebrationsByDate(params.date);
    if (celebrations.length === 0) {
      throw new LibraryError("celebration-not-covered");
    }
    return { celebration: celebrations[0], celebrations };
  }

  const query = celebrationQuerySchema.safeParse(params);
  if (!query.success) {
    throw new LibraryError("invalid-data", query.error.issues[0]?.message ?? "Parâmetros de busca inválidos.");
  }
  return searchCelebrations(query.data);
});
