import { LibraryError } from "@/features/library/domain/library-errors";
import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { diagnoseCelebrationSuggestions, getCelebrationById } from "@/server/liturgy/liturgy-service";

/** Quantas músicas são elegíveis para cada momento desta celebração, e por que as demais ficam de fora. */
export const GET = adminRoute<{ id: string }>(async ({ params }) => {
  const celebration = await getCelebrationById(params.id);
  if (!celebration) {
    throw new LibraryError("celebration-not-found");
  }
  return jsonResponse(await diagnoseCelebrationSuggestions(celebration));
});
