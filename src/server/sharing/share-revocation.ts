import "server-only";

import type { ClientSession } from "mongoose";

import { RepertoireShareModel } from "@/server/database/models/repertoire-share-model";

/** Efeito de revogar: o conteúdo é apagado e a assinatura antiga deixa de ser válida. */
export function revocationUpdate(now: Date) {
  return {
    $set: { status: "revoked" as const, revokedAt: now, updatedAt: now },
    $unset: { snapshot: 1 as const, contentHash: 1 as const },
    $inc: { revision: 1, tokenVersion: 1 },
  };
}

export async function revokeRepertoireShares(
  ownerId: string,
  repertoireId: string,
  session: ClientSession,
): Promise<void> {
  await RepertoireShareModel.updateMany(
    { ownerId, repertoireId, status: "active" },
    revocationUpdate(new Date()),
    { session },
  );
}
