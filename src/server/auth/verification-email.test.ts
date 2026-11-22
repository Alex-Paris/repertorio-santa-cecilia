// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { sendVerificationEmail } from "./verification-email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("envio de confirmação", () => {
  const email = { to: "ana@exemplo.test", url: "https://repertorio.example/api/auth/verify-email?token=secreto" };

  function configure() {
    vi.stubEnv("RESEND_API_KEY", "chave-secreta-de-teste");
    vi.stubEnv("AUTH_EMAIL_FROM", "contas@exemplo.test");
  }

  it("aguarda o Resend e envia o link só no corpo da mensagem", async () => {
    configure();
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);

    await sendVerificationEmail(email);

    expect(fetch).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ authorization: "Bearer chave-secreta-de-teste" }),
      signal: expect.any(AbortSignal),
    }));
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.to).toEqual([email.to]);
    expect(body.from).toContain("contas@exemplo.test");
    const url = new URL(body.text.match(/https:\/\/[^\s]+/)[0]);
    expect(url.searchParams.get("token")).toBe("secreto");
    expect(url.searchParams.get("callbackURL")).toBe("/entrar?email=confirmado");
    expect(body.text).toContain("1 hora");
  });

  it.each(["http", "network"])("oculta segredos quando ocorre falha %s", async (failure) => {
    configure();
    const fetch = vi.fn();
    if (failure === "http") fetch.mockResolvedValue(new Response("segredo do provedor", { status: 403 }));
    else fetch.mockRejectedValue(new Error(email.url));
    vi.stubGlobal("fetch", fetch);

    await expect(sendVerificationEmail(email)).rejects.toThrow("Não foi possível enviar o e-mail de confirmação.");
  });

  it("não envia sem configuração", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(sendVerificationEmail(email)).rejects.toThrow("não configurado");
    expect(fetch).not.toHaveBeenCalled();
  });
});
