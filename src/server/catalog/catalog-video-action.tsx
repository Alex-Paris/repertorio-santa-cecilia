import "server-only";

import { headers } from "next/headers";

import { CatalogVideoEditor } from "@/features/catalog/components/catalog-video-editor";
import { lookupSession } from "@/server/auth/session";

import { createCatalogAdminService, isCatalogAdmin } from "./catalog-service";

/** A indisponibilidade desta ação nunca impede a consulta pública da música. */
export async function CatalogVideoAction({ songId }: { songId: string }) {
  const lookup = await lookupSession(await headers());
  if (lookup.status !== "authenticated") return null;
  const userId = lookup.session.user.id;
  const song = await (async () => {
    try {
      if (!(await isCatalogAdmin(userId))) return null;
      return await createCatalogAdminService(userId).get(songId);
    } catch {
      return null;
    }
  })();
  return song ? <CatalogVideoEditor key={song.id} userId={userId} song={{ id: song.id, revision: song.revision, video: song.video }} /> : null;
}
