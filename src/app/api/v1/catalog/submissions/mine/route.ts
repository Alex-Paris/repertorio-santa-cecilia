import { jsonResponse } from "@/server/http/api-error";
import { submissionRoute } from "@/server/http/submission-route";

export const GET = submissionRoute(async ({ submissions }) => jsonResponse({ submissions: await submissions.listMine() }));
