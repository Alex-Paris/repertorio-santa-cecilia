// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getConnectedAuth } from "@/server/auth/auth";
import { ServerConfigurationError } from "@/server/env";

import { GET, POST } from "./route";

vi.mock("@/server/auth/auth", () => ({ getConnectedAuth: vi.fn() }));
const handler = vi.fn();

beforeEach(() => {
  handler.mockReset();
  vi.mocked(getConnectedAuth).mockResolvedValue({ handler } as never);
});
afterEach(() => vi.restoreAllMocks());

describe("rota do Better Auth", () => {
  it.each([200, 400, 403, 404, 429, 500])("preserva a resposta %i da biblioteca, sem convertê-la em 503", async (status) => {
    const response = Response.json({ status }, { status, headers: { "x-auth": "preservado" } });
    handler.mockResolvedValue(response);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new Request("https://repertorio.example/api/auth/sign-in/social", { method: "POST" });

    const actual = await POST(request);

    expect(actual).toBe(response);
    expect(handler).toHaveBeenCalledWith(request);
    expect(log).not.toHaveBeenCalled();
  });

  it("correlaciona um 503 de configuração com os nomes das variáveis apenas nos logs", async () => {
    vi.mocked(getConnectedAuth).mockRejectedValue(new ServerConfigurationError(["MONGODB_DB_NAME"]));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(new Request("https://repertorio.example/api/auth/get-session"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("persistence_failed");
    expect(body.error.requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(JSON.parse(String(log.mock.calls[0][1]))).toMatchObject({
      requestId: body.error.requestId, phase: "prepare-auth", invalidVariables: ["MONGODB_DB_NAME"],
    });
    expect(JSON.stringify(body)).not.toContain("MONGODB_DB_NAME");
    expect(handler).not.toHaveBeenCalled();
  });

  it("não expõe dados da requisição nem da exceção ao tratar falha no handler", async () => {
    handler.mockRejectedValue(new Error("mongodb://usuario:senha@host interno"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new Request("https://repertorio.example/api/auth/sign-in/social?token=token-secreto", {
      method: "POST", headers: { cookie: "cookie-secreto" }, body: "senha-secreta",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(JSON.parse(String(log.mock.calls[0][1])).phase).toBe("auth-handler");
    expect(JSON.stringify({ body, logs: log.mock.calls })).not.toMatch(/senha|token-secreto|cookie-secreto|mongodb|host interno/);
  });
});
