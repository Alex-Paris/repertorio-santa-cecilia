// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectedAuth } from "./auth";
import { lookupSession } from "./session";

vi.mock("./auth", () => ({ getConnectedAuth: vi.fn() }));

const withCookie = new Headers({ cookie: "sessao=valor" });

function mockSession(getSession: () => Promise<unknown>): void {
  vi.mocked(getConnectedAuth).mockResolvedValue({ api: { getSession } } as never);
}

afterEach(() => vi.restoreAllMocks());

describe("lookupSession", () => {
  it("expõe apenas os dados públicos do usuário", async () => {
    mockSession(async () => ({
      user: { id: "u1", name: "Ana", email: "ana@exemplo.test", emailVerified: false },
      session: { token: "token-secreto", expiresAt: new Date("2026-12-01T00:00:00.000Z") },
    }));

    const result = await lookupSession(withCookie);

    expect(result).toEqual({
      status: "authenticated",
      session: {
        user: { id: "u1", name: "Ana", email: "ana@exemplo.test" },
        expiresAt: new Date("2026-12-01T00:00:00.000Z"),
      },
    });
  });

  it("identifica visitante sem sessão", async () => {
    mockSession(async () => null);
    await expect(lookupSession(withCookie)).resolves.toEqual({ status: "anonymous" });
  });

  it("sem cookie, responde sem depender do banco", async () => {
    vi.mocked(getConnectedAuth).mockClear();

    await expect(lookupSession(new Headers())).resolves.toEqual({ status: "anonymous" });

    expect(getConnectedAuth).not.toHaveBeenCalled();
  });

  it("trata falha ao conectar como serviço indisponível", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getConnectedAuth).mockRejectedValue(new Error("sem conexão"));

    await expect(lookupSession(withCookie)).resolves.toEqual({ status: "unavailable" });
  });

  it("transforma a falha do banco em estado, sem registrar a mensagem original", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSession(async () => {
      throw new Error("mongodb://usuario:senha@host indisponível");
    });

    await expect(lookupSession(withCookie)).resolves.toEqual({ status: "unavailable" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("senha");
  });
});
