import "server-only";

import { LibraryError } from "@/features/library/domain/library-errors";

/** Somente uma ETag forte com a revisão, como `"3"`. `*` e listas não servem de precondição. */
const IF_MATCH_PATTERN = /^"([1-9]\d{0,14})"$/;

/**
 * Revisão que o cliente espera alterar, lida de `If-Match`. Sem ela a escrita é recusada
 * com 428: uma atualização sem precondição poderia sobrescrever outra alteração.
 */
export function readExpectedRevision(request: Request): number {
  const match = IF_MATCH_PATTERN.exec(request.headers.get("if-match")?.trim() ?? "");
  if (!match) {
    throw new LibraryError("revision-required");
  }
  return Number(match[1]);
}

/** Anuncia a revisão atual de um documento único. */
export function withETag(response: Response, revision: number): Response {
  response.headers.set("ETag", `"${revision}"`);
  return response;
}
