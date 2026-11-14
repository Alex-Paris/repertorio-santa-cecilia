import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SHARE_ID_BYTES = 16;
const TOKEN_PATTERN = /^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/;

export interface ParsedShareToken {
  shareId: string;
  signature: string;
}

/** 128 bits aleatórios: não há sequência nem relação com o proprietário. */
export function generateShareId(): string {
  return randomBytes(SHARE_ID_BYTES).toString("base64url");
}

function sign(secret: string, shareId: string, tokenVersion: number): string {
  return createHmac("sha256", secret)
    .update(`repertorio-share:v1:${shareId}:${tokenVersion}`)
    .digest("base64url");
}

/** O token é derivado: o proprietário recupera o link sem que um segredo fique no banco. */
export function createShareToken(secret: string, shareId: string, tokenVersion: number): string {
  return `${shareId}.${sign(secret, shareId, tokenVersion)}`;
}

export function getSharePath(token: string): string {
  return `/s/${token}`;
}

/** Recusa pelo formato antes de qualquer consulta ao banco. */
export function parseShareToken(token: unknown): ParsedShareToken | null {
  if (typeof token !== "string") {
    return null;
  }
  const match = TOKEN_PATTERN.exec(token);
  return match ? { shareId: match[1], signature: match[2] } : null;
}

export function verifyShareSignature(
  secret: string,
  { shareId, signature }: ParsedShareToken,
  tokenVersion: number,
): boolean {
  const expected = Buffer.from(sign(secret, shareId, tokenVersion));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
