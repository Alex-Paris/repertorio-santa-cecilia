import "server-only";

import { LibraryError, SongInUseError, type LibraryErrorCode } from "@/features/library/domain/library-errors";

export type ApiErrorCode =
  | "invalid_input"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "remote_library_not_empty"
  | "import_id_conflict"
  | "session_changed"
  | "rate_limited"
  | "precondition_failed"
  | "precondition_required"
  | "payload_too_large"
  | "unsupported_media_type"
  | "persistence_failed"
  | "internal_error";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const LIBRARY_ERROR_RESPONSES: Record<LibraryErrorCode, [number, ApiErrorCode]> = {
  "invalid-data": [400, "invalid_input"],
  // Recurso de outro usuário e recurso inexistente são indistinguíveis.
  "song-not-found": [404, "not_found"],
  "repertoire-not-found": [404, "not_found"],
  "repertoire-item-not-found": [404, "not_found"],
  "song-in-use": [409, "conflict"],
  "song-already-in-repertoire": [409, "conflict"],
  conflict: [409, "conflict"],
  "persistence-failed": [503, "persistence_failed"],
  "remote-library-not-empty": [409, "remote_library_not_empty"],
  "import-id-conflict": [409, "import_id_conflict"],
  "import-limit-exceeded": [413, "payload_too_large"],
  "catalog-song-not-found": [404, "not_found"],
  "catalog-song-unavailable": [409, "conflict"],
  "catalog-admin-required": [403, "forbidden"],
  "rate-limited": [429, "rate_limited"],
  "celebration-not-covered": [404, "not_found"],
  "celebration-not-found": [404, "not_found"],
  // Proposta de outra conta e proposta inexistente são indistinguíveis.
  "submission-not-found": [404, "not_found"],
  "submission-active": [409, "conflict"],
  "submission-limit-exceeded": [429, "rate_limited"],
  "submission-daily-limit": [429, "rate_limited"],
  "submission-already-reviewed": [409, "conflict"],
  "submission-duplicates": [409, "conflict"],
  "submission-content-too-large": [413, "payload_too_large"],
  "revision-conflict": [412, "precondition_failed"],
  "revision-required": [428, "precondition_required"],
  "share-not-found": [404, "not_found"],
  "share-conflict": [409, "conflict"],
  "share-preview-outdated": [409, "conflict"],
  "share-limit-exceeded": [409, "conflict"],
  "share-rate-limited": [429, "rate_limited"],
  "sharing-disabled": [403, "forbidden"],
  "session-expired": [401, "unauthenticated"],
  "session-changed": [409, "session_changed"],
  forbidden: [403, "forbidden"],
  "remote-unavailable": [503, "persistence_failed"],
  "write-uncertain": [503, "persistence_failed"],
  "invalid-response": [500, "internal_error"],
  "request-cancelled": [500, "internal_error"],
  "storage-unavailable": [500, "internal_error"],
  "quota-exceeded": [500, "internal_error"],
};

const PRIVATE_CACHE_CONTROL = "private, no-store";
const PRIVATE_HEADERS = { "Cache-Control": PRIVATE_CACHE_CONTROL };

/** Toda resposta com dados de um usuário, inclusive as sem corpo. */
export function markPrivate(response: Response): Response {
  response.headers.set("Cache-Control", PRIVATE_CACHE_CONTROL);
  return response;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: PRIVATE_HEADERS });
}

/** Resposta padronizada, sem stack trace nem mensagem interna do banco. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return jsonResponse(
      { error: { code: error.code, message: error.message, ...error.details } },
      error.status,
    );
  }

  if (error instanceof LibraryError) {
    const [status, code] = LIBRARY_ERROR_RESPONSES[error.code];
    const details =
      error instanceof SongInUseError ? { repertoires: error.repertoires } : undefined;
    return jsonResponse(
      { error: { code, reason: error.code, message: error.message, ...details } },
      status,
    );
  }

  console.error(`[api] Erro inesperado: ${error instanceof Error ? error.name : "desconhecido"}.`);
  return jsonResponse(
    { error: { code: "internal_error", message: "Ocorreu um erro inesperado." } },
    500,
  );
}
