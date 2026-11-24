import "server-only";

import { MongoServerSelectionError } from "mongodb";

import { ServerConfigurationError } from "@/server/env";

const ERROR_TYPES = new Set([
  "Error", "TypeError", "SyntaxError", "ServerConfigurationError", "BetterAuthError", "APIError",
  "MongoParseError", "MongoInvalidArgumentError", "MongoServerError", "MongoServerSelectionError",
  "MongoNetworkError", "MongoNetworkTimeoutError", "MongoTopologyClosedError", "MongoNotConnectedError",
]);
const NETWORK_CODES = new Set([
  "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EHOSTUNREACH",
  "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR",
]);
interface ErrorSummary {
  type: string;
  code?: string | number;
  cause?: ErrorSummary;
}

function summarize(error: unknown, depth = 0): ErrorSummary {
  if (!(error instanceof Error)) return { type: "UnknownError" };
  const summary: ErrorSummary = { type: ERROR_TYPES.has(error.name) ? error.name : "UnknownError" };
  const code = (error as Error & { code?: unknown }).code;
  if (typeof code === "number" && Number.isSafeInteger(code)) summary.code = code;
  if (typeof code === "string" && NETWORK_CODES.has(code)) summary.code = code;
  if (depth < 2 && error.cause instanceof Error) summary.cause = summarize(error.cause, depth + 1);
  return summary;
}

/** Registra apenas metadados permitidos. Nunca serializa o erro, mensagem, stack ou requisição. */
export function reportAuthFailure(error: unknown, phase: "prepare-auth" | "auth-handler"): string {
  const requestId = crypto.randomUUID();
  let diagnostic: object;
  try {
    diagnostic = {
      event: "auth-service-failure",
      requestId,
      phase,
      error: summarize(error),
      ...(error instanceof ServerConfigurationError ? {
        invalidVariables: error.variableNames,
      } : {}),
      ...(error instanceof MongoServerSelectionError ? {
        servers: [...(error.reason?.servers.values() ?? [])].slice(0, 3).map((server) => summarize(server.error)),
      } : {}),
    };
  } catch {
    diagnostic = { event: "auth-service-failure", requestId, phase, error: { type: "UnknownError" } };
  }
  console.error("[auth]", JSON.stringify(diagnostic));
  return requestId;
}
