import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LIBRARY_STORAGE_KEY } from "@/features/library/data/library-storage";

import { getAuthErrorMessage, parseSignUp } from "../services/auth-form";
import { SignInForm } from "./sign-in-form";
import { SignOutButton } from "./sign-out-button";
import { SignUpForm } from "./sign-up-form";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const authClient = vi.hoisted(() => ({
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../auth-client", () => ({ authClient }));

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  authClient.signIn.email.mockResolvedValue({ error: null });
  authClient.signUp.email.mockResolvedValue({ error: null });
  authClient.signOut.mockResolvedValue({ error: null });
});

afterEach(() => vi.unstubAllGlobals());

describe("login", () => {
  function submit(): void {
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  }

  it("valida os campos em português, sem chamar o servidor", () => {
    render(<SignInForm signUpEnabled />);

    submit();

    expect(screen.getByText("Informe um e-mail válido.")).toBeDefined();
    expect(screen.getByText("Informe sua senha.")).toBeDefined();
    expect(authClient.signIn.email).not.toHaveBeenCalled();
  });

  it("entra, limpa a senha e abre a conta", async () => {
    render(<SignInForm signUpEnabled />);
    type("E-mail", "ana@exemplo.test");
    type("Senha", "senha-123456");

    submit();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(authClient.signIn.email).toHaveBeenCalledWith({ email: "ana@exemplo.test", password: "senha-123456" });
    expect((screen.getByLabelText("Senha") as HTMLInputElement).value).toBe("");
  });

  it("mostra erro de credenciais em português", async () => {
    authClient.signIn.email.mockResolvedValue({ error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid" } });
    render(<SignInForm signUpEnabled />);
    type("E-mail", "ana@exemplo.test");
    type("Senha", "errada-123456");

    submit();

    expect((await screen.findByRole("alert")).textContent).toContain("E-mail ou senha incorretos.");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("trata falha de rede", async () => {
    authClient.signIn.email.mockRejectedValue(new Error("rede"));
    render(<SignInForm signUpEnabled />);
    type("E-mail", "ana@exemplo.test");
    type("Senha", "senha-123456");

    submit();

    expect((await screen.findByRole("alert")).textContent).toContain("Tente novamente");
  });

  it("só oferece cadastro quando permitido", () => {
    const { rerender } = render(<SignInForm signUpEnabled />);
    expect(screen.getByRole("link", { name: "Criar conta" })).toBeDefined();

    rerender(<SignInForm signUpEnabled={false} />);
    expect(screen.queryByRole("link", { name: "Criar conta" })).toBeNull();
  });
});

describe("cadastro", () => {
  function fill(): void {
    type("Nome", "Ana");
    type("E-mail", "ana@exemplo.test");
    type("Senha", "senha-123456");
    type("Confirmar senha", "senha-123456");
  }

  function submit(): void {
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
  }

  it("cria a conta sem enviar a confirmação", async () => {
    render(<SignUpForm />);
    fill();

    submit();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(authClient.signUp.email).toHaveBeenCalledWith({
      name: "Ana",
      email: "ana@exemplo.test",
      password: "senha-123456",
    });
  });

  it("valida nome, e-mail e tamanho da senha", () => {
    render(<SignUpForm />);
    type("Senha", "curta");

    submit();

    expect(screen.getByText("Informe seu nome.")).toBeDefined();
    expect(screen.getByText("Informe um e-mail válido.")).toBeDefined();
    expect(screen.getByText("A senha deve ter pelo menos 8 caracteres.")).toBeDefined();
    expect(authClient.signUp.email).not.toHaveBeenCalled();
  });

  it("exige senhas iguais", () => {
    render(<SignUpForm />);
    fill();
    type("Confirmar senha", "outra-senha-123");

    submit();

    expect(screen.getByText("As senhas não coincidem.")).toBeDefined();
    expect(authClient.signUp.email).not.toHaveBeenCalled();
  });

  it("não confirma se um e-mail já está cadastrado", async () => {
    authClient.signUp.email.mockResolvedValue({ error: { code: "USER_ALREADY_EXISTS" } });
    render(<SignUpForm />);
    fill();

    submit();

    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível criar a conta");
  });

  it("recusa senha acima do limite", () => {
    const result = parseSignUp({
      name: "Ana",
      email: "ana@exemplo.test",
      password: "x".repeat(129),
      confirmation: "x".repeat(129),
    });
    expect(result.success).toBe(false);
  });
});

describe("mensagens de erro", () => {
  it("nunca devolve o texto original de um erro desconhecido", () => {
    expect(getAuthErrorMessage("ERRO_INTERNO_XYZ")).toBe("Não foi possível concluir agora. Tente novamente.");
    expect(getAuthErrorMessage(undefined)).toBe("Não foi possível concluir agora. Tente novamente.");
  });
});

describe("sair", () => {
  it("encerra a sessão, recarrega a tela e preserva a biblioteca local", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });
    localStorage.setItem(LIBRARY_STORAGE_KEY, "biblioteca local");
    render(<SignOutButton />);

    fireEvent.click(screen.getByRole("button", { name: "Sair da conta" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/entrar"));
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBe("biblioteca local");
  });

  it("avisa quando não consegue sair", async () => {
    authClient.signOut.mockResolvedValue({ error: { code: "ERRO" } });
    render(<SignOutButton />);

    fireEvent.click(screen.getByRole("button", { name: "Sair da conta" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível sair");
  });
});
