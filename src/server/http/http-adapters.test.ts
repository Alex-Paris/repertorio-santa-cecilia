// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { LibraryError, SongInUseError } from "@/features/library/domain/library-errors";
import { getSessionFromHeaders } from "@/server/auth/session";

import { ApiError, toErrorResponse } from "./api-error";
import { authenticatedRoute } from "./authenticated-route";
import { MAX_JSON_BODY_BYTES, readJsonBody } from "./read-json-body";

vi.mock("@/server/auth/session", () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock("@/server/library/library-service", () => ({
  createLibraryService: (ownerId: string) => ({ ownerId }),
}));

const ORIGIN = "http://localhost:3000";
const session = {
  user: { id: "usuario-da-sessao", name: "Ana", email: "ana@exemplo.test" },
  expiresAt: new Date(),
};
const noParams = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.stubEnv("MONGODB_URI", "mongodb://localhost:27017");
  vi.stubEnv("MONGODB_DB_NAME", "teste");
  vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
  vi.stubEnv("BETTER_AUTH_URL", ORIGIN);
  vi.mocked(getSessionFromHeaders).mockResolvedValue(session);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("toErrorResponse", () => {
  it.each([
    [new LibraryError("invalid-data"), 400, "invalid_input"],
    [new LibraryError("song-not-found"), 404, "not_found"],
    [new LibraryError("repertoire-not-found"), 404, "not_found"],
    [new LibraryError("repertoire-item-not-found"), 404, "not_found"],
    [new LibraryError("song-already-in-repertoire"), 409, "conflict"],
    [new LibraryError("conflict"), 409, "conflict"],
    [new LibraryError("persistence-failed"), 503, "persistence_failed"],
    [new ApiError(401, "unauthenticated", "Entre."), 401, "unauthenticated"],
  ])("%s", async (error, status, code) => {
    const response = toErrorResponse(error);

    expect(response.status).toBe(status);
    expect((await response.json()).error.code).toBe(code);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("inclui os repertórios ao bloquear uma exclusão", async () => {
    const body = await toErrorResponse(new SongInUseError([{ id: "r", name: "Show" }])).json();
    expect(body.error).toMatchObject({ code: "conflict", repertoires: [{ id: "r", name: "Show" }] });
  });

  it("não revela detalhes de erros inesperados", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("mongodb://usuario:senha@host falhou");

    const response = toErrorResponse(error);
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain("senha");
    expect(text).not.toContain("stack");
    expect(JSON.stringify(log.mock.calls)).not.toContain("senha");
  });
});

describe("readJsonBody", () => {
  const schema = z.strictObject({ name: z.string() });

  function jsonRequest(body: string, contentType = "application/json"): Request {
    return new Request(ORIGIN, { method: "POST", headers: { "content-type": contentType }, body });
  }

  it("aceita JSON válido, inclusive com charset", async () => {
    await expect(readJsonBody(jsonRequest('{"name":"a"}', "application/json; charset=utf-8"), schema)).resolves.toEqual({ name: "a" });
  });

  it.each([
    ["JSON malformado", "{ a", "application/json", 400],
    ["campo extra", '{"name":"a","ownerId":"b"}', "application/json", 400],
    ["tipo errado", '{"name":1}', "application/json", 400],
    ["conteúdo que não é JSON", '{"name":"a"}', "text/plain", 415],
  ])("rejeita %s", async (_name, body, contentType, status) => {
    await expect(readJsonBody(jsonRequest(body, contentType), schema)).rejects.toMatchObject({ status });
  });

  it("mede o limite em bytes, e não em caracteres", async () => {
    const body = JSON.stringify({ name: "é".repeat(MAX_JSON_BODY_BYTES / 2 + 10) });
    await expect(readJsonBody(jsonRequest(body), schema)).rejects.toMatchObject({ status: 413 });
  });

  it("recusa pelo Content-Length antes de ler o corpo", async () => {
    const request = new Request(ORIGIN, {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(MAX_JSON_BODY_BYTES + 1) },
      body: "{}",
    });
    const text = vi.spyOn(request, "text");

    await expect(readJsonBody(request, schema)).rejects.toMatchObject({ status: 413 });
    expect(text).not.toHaveBeenCalled();
  });
});

describe("authenticatedRoute", () => {
  function route() {
    return authenticatedRoute(async ({ library }) => Response.json(library));
  }

  it("responde 401 sem sessão, sem executar a rota", async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(null);
    const handler = vi.fn();

    const response = await authenticatedRoute(handler)(new Request(ORIGIN), noParams);

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("usa o proprietário da sessão, e nunca um valor da requisição", async () => {
    const response = await route()(new Request(`${ORIGIN}/?ownerId=outro`, { headers: { "x-owner-id": "outro" } }), noParams);

    expect(await response.json()).toEqual({ ownerId: "usuario-da-sessao" });
  });

  it("responde 503 quando a sessão não pode ser verificada", async () => {
    vi.mocked(getSessionFromHeaders).mockRejectedValue(new Error("sem conexão"));

    const response = await route()(new Request(ORIGIN), noParams);

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sem conexão");
  });

  it("recusa alterações de outra origem antes de consultar a sessão", async () => {
    const request = new Request(ORIGIN, {
      method: "POST",
      headers: { origin: "https://site-malicioso.example" },
    });

    const response = await route()(request, noParams);

    expect(response.status).toBe(403);
    expect(getSessionFromHeaders).not.toHaveBeenCalled();
  });

  it.each([ORIGIN, null])("aceita alteração com origem %s", async (origin) => {
    const request = new Request(ORIGIN, { method: "POST", headers: origin ? { origin } : {} });
    expect((await route()(request, noParams)).status).toBe(200);
  });

  it("não aplica a regra de origem a leituras", async () => {
    const request = new Request(ORIGIN, { headers: { origin: "https://outro.example" } });
    expect((await route()(request, noParams)).status).toBe(200);
  });

  it("padroniza erros da rota", async () => {
    const failing = authenticatedRoute(async () => {
      throw new LibraryError("song-not-found");
    });

    expect((await failing(new Request(ORIGIN), noParams)).status).toBe(404);
  });
});
