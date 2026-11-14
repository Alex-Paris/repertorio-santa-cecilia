import { z } from "zod";

import { LITURGICAL_MOMENT_IDS } from "@/features/liturgy/domain/vocabulary";
import { SONG_SOURCES } from "@/features/songs/domain/song";
import { entityIdSchema } from "@/features/songs/domain/song-schema";
import { jsonResponse } from "@/server/http/api-error";
import { authenticatedRoute } from "@/server/http/authenticated-route";
import { readJsonBody } from "@/server/http/read-json-body";
import { readExpectedRevision, withETag } from "@/server/http/revision";

/** A origem é validada aqui e conferida de novo no repositório; sem ela, a música é particular. */
const addSongSchema = z.strictObject({
  songId: entityIdSchema,
  source: z.enum(SONG_SOURCES).optional().default("personal"),
  /** Momento da missa, quando a música é escolhida na preparação de uma celebração. */
  moment: z.enum(LITURGICAL_MOMENT_IDS).optional(),
});

export const POST = authenticatedRoute<{ id: string }>(async ({ request, params, library }) => {
  const expectedRevision = readExpectedRevision(request);
  const { songId, source, moment } = await readJsonBody(request, addSongSchema);
  const repertoire = await library.repertoires.addSong(params.id, songId, expectedRevision, source, moment);
  return withETag(jsonResponse({ repertoire }, 201), repertoire.revision);
});
