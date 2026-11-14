import { z } from "zod";

import { celebrationDisplayTitle, isValidIsoDate } from "@/features/liturgy/domain/calendar";
import { LITURGICAL_MOMENT_IDS } from "@/features/liturgy/domain/vocabulary";
import { LibraryError } from "@/features/library/domain/library-errors";
import { entityIdSchema } from "@/features/songs/domain/song-schema";
import { publicCatalogRoute } from "@/server/http/public-catalog-route";
import { getCelebrationSuggestions, getCelebrationsByDate, pickCelebration } from "@/server/liturgy/liturgy-service";

const querySchema = z.strictObject({
  date: z.string().refine(isValidIsoDate),
  /** Quando a data tem mais de uma celebração ou formulário. */
  celebration: entityIdSchema.optional(),
  moment: z.enum(LITURGICAL_MOMENT_IDS).optional(),
});

/** Sugestões do Repertório Web para a celebração, com o grau de segurança dos dados. */
export const GET = publicCatalogRoute(async ({ request }) => {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    throw new LibraryError("invalid-data", "Informe a data (AAAA-MM-DD) e, se quiser, a celebração e um momento da missa.");
  }

  const celebrations = await getCelebrationsByDate(parsed.data.date);
  const celebration = pickCelebration(celebrations, parsed.data.celebration);
  if (!celebration || (parsed.data.celebration && celebration.celebrationId !== parsed.data.celebration)) {
    throw new LibraryError(celebrations.length === 0 ? "celebration-not-covered" : "celebration-not-found");
  }

  const { assurance, cautions, moments, catalog } = await getCelebrationSuggestions(celebration, parsed.data.moment);
  return {
    celebration: {
      date: celebration.date,
      celebrationId: celebration.celebrationId,
      title: celebrationDisplayTitle(celebration),
      reviewStatus: celebration.review.status,
      revision: celebration.revision,
    },
    assurance,
    cautions,
    catalog,
    moments,
  };
});
