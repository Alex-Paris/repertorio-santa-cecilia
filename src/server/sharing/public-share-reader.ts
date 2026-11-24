import "server-only";

import type { ClientSession } from "mongoose";

import {
  publicShareSnapshotSchema,
  type PublicShareSnapshot,
} from "@/features/sharing/domain/public-share";
import { canShareChordPro } from "@/features/catalog/domain/catalog-song";
import { CatalogSongModel } from "@/server/database/models/catalog-song-model";
import {
  RepertoireShareModel,
  type ShareSourceDocument,
} from "@/server/database/models/repertoire-share-model";
import { runPersistence } from "@/server/repositories/persistence";

import { getSharingConfig } from "./share-config";
import { parseShareToken, verifyShareSignature } from "./share-token";

/**
 * Um snapshot não autoriza distribuição perpétua: a cada leitura, músicas do catálogo que
 * saíram do ar ou perderam a permissão de redistribuição deixam de entregar conteúdo.
 */
async function withCurrentCatalogRights(
  snapshot: PublicShareSnapshot,
  sources: readonly ShareSourceDocument[],
  session?: ClientSession,
): Promise<PublicShareSnapshot> {
  const catalogItemIds = new Map(
    sources.filter((source) => source.source === "catalog").map((source) => [source.publicItemId, source.songId]),
  );
  if (catalogItemIds.size === 0) {
    return snapshot;
  }

  const documents = await runPersistence(() =>
    CatalogSongModel.find(
      { id: { $in: [...new Set(catalogItemIds.values())] } },
      { _id: 0, id: 1, status: 1, contentType: 1, rights: 1 },
    ).session(session ?? null).lean(),
  );
  const current = new Map(documents.map((document) => [document.id, document]));

  return {
    ...snapshot,
    items: snapshot.items.map((item) => {
      const songId = catalogItemIds.get(item.id);
      if (!songId) {
        return item;
      }
      const song = current.get(songId);
      const allowed =
        song?.status === "published" &&
        (item.content.kind !== "chordpro" || canShareChordPro(song));
      if (allowed && item.content.kind === "external-link" && song.rights?.linkExternalSource === false) {
        // A permissão de mostrar o link foi retirada depois da publicação: fica só a identificação.
        return { ...item, content: { kind: "none" as const } };
      }
      return allowed || item.content.kind === "none" ? item : { ...item, content: { kind: "unavailable" } };
    }),
  };
}

/**
 * Único caminho de leitura sem sessão. Consulta o estado atual a cada chamada, lê apenas
 * o que foi publicado e responde igual para link inválido, revogado ou inexistente.
 */
export async function readPublicShareRecord(token: string, session?: ClientSession) {
  const { enabled, secret } = getSharingConfig();
  const parsed = parseShareToken(token);

  if (!enabled || !secret || !parsed) {
    return null;
  }

  const document = await runPersistence(() =>
    RepertoireShareModel.findOne(
      { id: parsed.shareId, status: "active" },
      { _id: 0, snapshot: 1, tokenVersion: 1, revision: 1, sources: 1 },
    ).session(session ?? null).lean(),
  );

  // Confere a assinatura mesmo sem documento, para o tempo de resposta não indicar qual ID existe.
  const isAuthentic = verifyShareSignature(secret, parsed, document?.tokenVersion ?? 0);
  if (!document || !isAuthentic) {
    return null;
  }

  const result = publicShareSnapshotSchema.safeParse(document.snapshot);
  if (!result.success) {
    return null;
  }
  return {
    id: parsed.shareId,
    tokenVersion: document.tokenVersion,
    revision: document.revision,
    snapshot: await withCurrentCatalogRights(result.data, document.sources ?? [], session),
    sources: document.sources ?? [],
  };
}

/** A projeção pública nunca inclui as referências de origem. */
export async function readPublicShare(token: string): Promise<PublicShareSnapshot | null> {
  return (await readPublicShareRecord(token))?.snapshot ?? null;
}

export type PublicShareResult =
  | { status: "ready"; share: PublicShareSnapshot }
  | { status: "unavailable" }
  | { status: "failed" };

/** Para as páginas: separa "este link não existe" de "o serviço falhou agora". */
export async function loadPublicShare(token: string): Promise<PublicShareResult> {
  try {
    const share = await readPublicShare(token);
    return share ? { status: "ready", share } : { status: "unavailable" };
  } catch {
    return { status: "failed" };
  }
}
