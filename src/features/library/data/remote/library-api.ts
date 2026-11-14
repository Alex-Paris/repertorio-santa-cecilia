import { z } from "zod";

import {
  isLibraryErrorCode,
  LibraryError,
  SongInUseError,
} from "../../domain/library-errors";

export const LIBRARY_API_BASE = "/api/v1/library";

/** O cliente informa de quem são os dados em tela; o servidor recusa se a sessão for de outro. */
export const EXPECTED_USER_HEADER = "x-repertorio-expected-user";
const DEFAULT_TIMEOUT_MS = 20_000;

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface LibraryApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Revisão esperada do documento, enviada como `If-Match`. */
  ifMatch?: number;
}

export interface LibraryApi {
  /** Valida a resposta com `schema`: dados remotos não são confiáveis até serem interpretados. */
  request<T>(path: string, schema: z.ZodType<T>, options?: LibraryApiOptions): Promise<T>;
  /** Para respostas sem corpo. */
  send(path: string, options?: LibraryApiOptions): Promise<void>;
}

const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string().max(500),
    reason: z.string().optional(),
    repertoires: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  }),
});

function toLibraryError(status: number, body: unknown): LibraryError {
  const parsed = errorBodySchema.safeParse(body);
  const error = parsed.success ? parsed.data.error : undefined;

  if (status >= 500) {
    return new LibraryError("remote-unavailable");
  }
  if (status === 401) {
    return new LibraryError("session-expired");
  }
  if (error?.code === "session_changed") {
    return new LibraryError("session-changed");
  }
  if (error?.repertoires) {
    return new SongInUseError(error.repertoires);
  }
  if (error?.reason && isLibraryErrorCode(error.reason)) {
    return new LibraryError(error.reason, error.message);
  }

  switch (status) {
    case 400:
    case 415:
    case 422:
      return new LibraryError("invalid-data", error?.message);
    case 403:
      return new LibraryError("forbidden");
    case 409:
      return new LibraryError("conflict", error?.message);
    case 412:
      return new LibraryError("revision-conflict");
    case 428:
      return new LibraryError("revision-required");
    case 413:
      return new LibraryError("import-limit-exceeded", error?.message);
    default:
      return new LibraryError("invalid-response");
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** Cliente da API privada, vinculado ao usuário cujos dados estão em tela. */
export function createLibraryApi({
  userId,
  fetchImpl = (input, init) => fetch(input, init),
  basePath = LIBRARY_API_BASE,
}: {
  userId: string;
  /** Outras APIs privadas, como a administração do catálogo, seguem o mesmo contrato. */
  basePath?: string;
  fetchImpl?: FetchLike;
}): LibraryApi {
  async function perform(path: string, options: LibraryApiOptions): Promise<Response> {
    const { method = "GET", body, signal, timeoutMs = DEFAULT_TIMEOUT_MS, ifMatch } = options;
    const controller = new AbortController();
    const cancel = (): void => controller.abort();
    const timer = setTimeout(cancel, timeoutMs);

    if (signal?.aborted) {
      throw new LibraryError("request-cancelled");
    }
    signal?.addEventListener("abort", cancel, { once: true });

    try {
      const response = await fetchImpl(`${basePath}${path}`, {
        method,
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
        headers: {
          [EXPECTED_USER_HEADER]: userId,
          ...(ifMatch === undefined ? {} : { "If-Match": `"${ifMatch}"` }),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });

      if (signal?.aborted) {
        throw new LibraryError("request-cancelled");
      }
      if (!response.ok) {
        throw toLibraryError(response.status, await readJson(response));
      }
      return response;
    } catch (error) {
      if (error instanceof LibraryError) {
        throw error;
      }
      // Sem resposta: a operação pode ou não ter sido concluída no servidor.
      throw new LibraryError(signal?.aborted ? "request-cancelled" : "remote-unavailable");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
  }

  return {
    async request(path, schema, options = {}) {
      const response = await perform(path, options);
      const result = schema.safeParse(await readJson(response));

      if (!result.success) {
        throw new LibraryError("invalid-response");
      }
      return result.data;
    },

    async send(path, options = {}) {
      await perform(path, options);
    },
  };
}
