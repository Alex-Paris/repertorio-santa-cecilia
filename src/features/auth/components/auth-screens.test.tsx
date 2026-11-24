import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SignInScreen } from "./sign-in-screen";
import { SignUpScreen } from "./sign-up-screen";

const lookupSession = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/server/auth/session", () => ({ lookupSession }));
vi.mock("../auth-client", () => ({ authClient: { signIn: { social: vi.fn() } } }));

beforeEach(() => {
  lookupSession.mockResolvedValue({ status: "anonymous" });
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("AUTH_ALLOW_DEV_SIGNUP", "true");
  vi.stubEnv("AUTH_ALLOW_SIGNUP", "false");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("FACEBOOK_CLIENT_ID", "");
  vi.stubEnv("FACEBOOK_CLIENT_SECRET", "");
});
afterEach(() => vi.unstubAllEnvs());

function configureFacebook() {
  vi.stubEnv("FACEBOOK_CLIENT_ID", "123456789");
  vi.stubEnv("FACEBOOK_CLIENT_SECRET", "segredo-que-nao-pode-ir-para-a-tela");
}

describe("oferta de Facebook nas telas públicas", () => {
  it("preserva login e cadastro por e-mail sem credenciais do Facebook", async () => {
    render(await SignInScreen());
    expect(screen.getByRole("button", { name: "Entrar" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Criar conta" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Continuar com Facebook" })).toBeNull();
  });

  it("oferece Facebook no login sem serializar o segredo", async () => {
    configureFacebook();
    const { container } = render(await SignInScreen());
    expect(screen.getByRole("button", { name: "Continuar com Facebook" })).toBeDefined();
    expect(container.innerHTML).not.toContain("segredo-que-nao-pode-ir-para-a-tela");
  });

  it("oferece Facebook no cadastro junto aos quatro campos existentes", async () => {
    configureFacebook();
    render(await SignUpScreen());
    expect(screen.getByRole("button", { name: "Continuar com Facebook" })).toBeDefined();
    expect(screen.getByLabelText("Nome")).toBeDefined();
    expect(screen.getByLabelText("E-mail")).toBeDefined();
    expect(screen.getByLabelText("Senha")).toBeDefined();
    expect(screen.getByLabelText("Confirmar senha")).toBeDefined();
  });

  it("configuração parcial não oferece um botão sem provedor funcional", async () => {
    vi.stubEnv("FACEBOOK_CLIENT_ID", "123456789");
    render(await SignInScreen());
    expect(screen.queryByRole("button", { name: "Continuar com Facebook" })).toBeNull();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeDefined();
  });

  it("fechar novos cadastros também fecha a oferta de cadastro pelo Facebook", async () => {
    configureFacebook();
    vi.stubEnv("AUTH_ALLOW_DEV_SIGNUP", "false");
    render(await SignUpScreen());
    expect(screen.getByText("Novos cadastros estão desativados")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Continuar com Facebook" })).toBeNull();
  });

  it("preserva o redirecionamento de quem já tem sessão", async () => {
    lookupSession.mockResolvedValue({ status: "authenticated" });
    await expect(SignInScreen()).rejects.toThrow("redirect:/conta");
    await expect(SignUpScreen()).rejects.toThrow("redirect:/conta");
  });

  it("quem já tem sessão volta à publicação sem ficar preso no login ou cadastro", async () => {
    lookupSession.mockResolvedValue({ status: "authenticated" });
    const path = `/s/${"a".repeat(22)}.${"b".repeat(43)}`;
    const props = { searchParams: Promise.resolve({ retorno: path }) };
    await expect(SignInScreen(props)).rejects.toThrow(`redirect:${path}`);
    await expect(SignUpScreen(props)).rejects.toThrow(`redirect:${path}`);
  });
});
