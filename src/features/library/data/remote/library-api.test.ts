import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { LibraryError, SongInUseError } from "../../domain/library-errors";
import { createLibraryApi, EXPECTED_USER_HEADER, type FetchLike } from "./library-api";

const schema = z.object({ value: z.number() });

function apiReturning(response: Response | Error) {
  const fetchImpl = vi.fn<FetchLike>(async () => {
    if (response instanceof Error) {
      throw response;
    }
    return response;
  });
  return { api: createLibraryApi({ userId: "u1", fetchImpl }), fetchImpl };
}

function errorResponse(status: number, error: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ error }), { status });
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => {
      throw new Error("deveria falhar");
    },
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(LibraryError);
  return (error as LibraryError).code;
}

describe("cliente da API privada", () => {
  it("envia a identidade esperada, sem cache e somente para a própria origem", async () => {
    const { api, fetchImpl } = apiReturning(new Response(JSON.stringify({ value: 1 })));

    await api.request("/songs", schema);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/v1/library/songs");
    expect(init.cache).toBe("no-store");
    expect(init.credentials).toBe("same-origin");
    expect((init.headers as Record<string, string>)[EXPECTED_USER_HEADER]).toBe("u1");
  });

  it("não confia em uma resposta fora do contrato", async () => {
    const { api } = apiReturning(new Response(JSON.stringify({ value: "texto" })));
    expect(await codeOf(api.request("/songs", schema))).toBe("invalid-response");
  });

  it("não confia em um corpo que não é JSON", async () => {
    const { api } = apiReturning(new Response("<html>"));
    expect(await codeOf(api.request("/songs", schema))).toBe("invalid-response");
  });

  it.each([
    [400, "invalid_input", "invalid-data"],
    [401, "unauthenticated", "session-expired"],
    [403, "forbidden", "forbidden"],
    [409, "conflict", "conflict"],
    [409, "session_changed", "session-changed"],
    [413, "payload_too_large", "import-limit-exceeded"],
    [412, "precondition_failed", "revision-conflict"],
    [428, "precondition_required", "revision-required"],
    [500, "internal_error", "remote-unavailable"],
    [503, "persistence_failed", "remote-unavailable"],
  ])("traduz HTTP %i (%s) para %s", async (status, code, expected) => {
    const { api } = apiReturning(errorResponse(status, { code, message: "Mensagem" }));
    expect(await codeOf(api.request("/songs", schema))).toBe(expected);
  });

  it("usa o motivo de domínio enviado pelo servidor", async () => {
    const { api } = apiReturning(
      errorResponse(404, { code: "not_found", reason: "song-not-found", message: "Sumiu" }),
    );
    expect(await codeOf(api.request("/songs/x", schema))).toBe("song-not-found");
  });

  it("recompõe o erro de música em uso", async () => {
    const repertoires = [{ id: "r1", name: "Show" }];
    const { api } = apiReturning(
      errorResponse(409, { code: "conflict", reason: "song-in-use", message: "Em uso", repertoires }),
    );

    await expect(api.send("/songs/x", { method: "DELETE" })).rejects.toBeInstanceOf(SongInUseError);
  });

  it("não expõe detalhes internos de um erro de servidor", async () => {
    const { api } = apiReturning(
      errorResponse(500, { code: "internal_error", message: "MongoServerError: stack" }),
    );
    const error = await api.request("/songs", schema).catch((caught: Error) => caught);
    expect((error as Error).message).not.toContain("Mongo");
  });

  it("trata falha de rede como indisponibilidade, não como lista vazia", async () => {
    const { api } = apiReturning(new TypeError("failed to fetch"));
    expect(await codeOf(api.request("/songs", schema))).toBe("remote-unavailable");
  });

  it("interrompe a requisição ao esgotar o tempo", async () => {
    const fetchImpl: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("x", "AbortError")));
      });
    const api = createLibraryApi({ userId: "u1", fetchImpl });

    expect(await codeOf(api.request("/songs", schema, { timeoutMs: 5 }))).toBe("remote-unavailable");
  });

  it("identifica o cancelamento pedido pelo chamador", async () => {
    const controller = new AbortController();
    controller.abort();
    const { api, fetchImpl } = apiReturning(new Response("{}"));

    expect(await codeOf(api.request("/songs", schema, { signal: controller.signal }))).toBe(
      "request-cancelled",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("envia a revisão esperada em If-Match", async () => {
    const { api, fetchImpl } = apiReturning(new Response(JSON.stringify({ value: 1 })));

    await api.request("/songs/x", schema, { method: "PUT", body: {}, ifMatch: 4 });

    expect((fetchImpl.mock.calls[0][1].headers as Record<string, string>)["If-Match"]).toBe('"4"');
  });

  it("não envia If-Match em leituras", async () => {
    const { api, fetchImpl } = apiReturning(new Response(JSON.stringify({ value: 1 })));

    await api.request("/songs", schema);

    expect(fetchImpl.mock.calls[0][1].headers).not.toHaveProperty("If-Match");
  });
});
