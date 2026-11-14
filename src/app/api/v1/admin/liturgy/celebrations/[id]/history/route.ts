import { adminRoute } from "@/server/http/admin-route";
import { jsonResponse } from "@/server/http/api-error";
import { createLiturgyAdminService } from "@/server/liturgy/celebration-store";

/** Histórico editorial da celebração, da alteração mais recente para a mais antiga. */
export const GET = adminRoute<{ id: string }>(async ({ params, userId }) =>
  jsonResponse({ history: await createLiturgyAdminService(userId).history(params.id) }),
);
