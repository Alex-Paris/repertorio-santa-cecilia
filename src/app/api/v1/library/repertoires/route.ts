import { repertoireInputSchema } from "@/features/repertoires/domain/repertoire-schema";
import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";
import { readJsonBody } from "@/server/http/read-json-body";
import { withETag } from "@/server/http/revision";

/** Junto com os repertórios, as músicas do catálogo que eles usam: uma leitura para a tela toda. */
export const GET = authenticatedRoute(async ({ library }) => {
  const repertoires = await library.repertoires.list();
  return jsonResponse({ repertoires, catalogSongs: await library.catalogSongsFor(repertoires) });
});

export const POST = authenticatedRoute(async ({ request, library }) => {
  const input = await readJsonBody(request, repertoireInputSchema);
  const repertoire = await library.repertoires.create(input);
  return withETag(jsonResponse({ repertoire }, 201), repertoire.revision);
});
