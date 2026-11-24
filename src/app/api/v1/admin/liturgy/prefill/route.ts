import { isValidIsoDate } from "@/features/liturgy/domain/calendar";
import { adminRoute } from "@/server/http/admin-route";
import { ApiError, jsonResponse } from "@/server/http/api-error";
import { assertWithinRateLimit } from "@/server/http/rate-limit";
import { fetchLiturgyPrefill } from "@/server/liturgy/liturgy-prefill";

export const GET = adminRoute(async ({ request, userId }) => {
  const query = new URL(request.url).searchParams;
  const date = query.get("date");
  if (query.getAll("date").length !== 1 || !isValidIsoDate(date) || [...query.keys()].some((key) => key !== "date")) {
    throw new ApiError(400, "invalid_input", "Informe somente uma data válida (AAAA-MM-DD).");
  }
  assertWithinRateLimit(request, `liturgy-prefill:${userId}`, 12);
  return jsonResponse(await fetchLiturgyPrefill(date, request.signal));
});
