import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FacebookAuthButton } from "./facebook-auth-button";

const social = vi.hoisted(() => vi.fn());
const query = vi.hoisted(() => ({ value: "" }));
vi.mock("../auth-client", () => ({ authClient: { signIn: { social } } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query.value) }));

beforeEach(() => {
  social.mockReset();
  query.value = "";
});

describe("Continuar com Facebook", () => {
  it("volta ao link compartilhado depois do Facebook, inclusive no cadastro e erro", async () => {
    const path = `/s/${"a".repeat(22)}.${"b".repeat(43)}`;
    query.value = `retorno=${encodeURIComponent(path)}`;
    social.mockResolvedValue({ data: { redirect: true }, error: null });
    render(<FacebookAuthButton />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar com Facebook" }));
    await waitFor(() => expect(social).toHaveBeenCalledWith({
      provider: "facebook", callbackURL: path, newUserCallbackURL: path,
      errorCallbackURL: `/entrar?social=facebook&retorno=${encodeURIComponent(path)}`,
    }));
  });
  it("inicia OAuth pelo Better Auth e indica que está abrindo o Facebook", async () => {
    social.mockResolvedValue({ data: { redirect: true, url: "https://www.facebook.com/dialog/oauth" }, error: null });
    render(<FacebookAuthButton />);

    fireEvent.click(screen.getByRole("button", { name: "Continuar com Facebook" }));

    await waitFor(() => expect(social).toHaveBeenCalledWith({
      provider: "facebook", callbackURL: "/", newUserCallbackURL: "/", errorCallbackURL: "/entrar?social=facebook",
    }));
    expect((screen.getByRole("button", { name: "Abrindo Facebook…" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("bloqueia cliques repetidos enquanto aguarda a resposta", () => {
    social.mockReturnValue(new Promise(() => {}));
    render(<FacebookAuthButton />);
    const button = screen.getByRole("button", { name: "Continuar com Facebook" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(social).toHaveBeenCalledTimes(1);
  });

  it.each(["http", "network"])("trata falha %s sem expor a resposta original", async (failure) => {
    if (failure === "http") social.mockResolvedValue({ error: { status: 500, message: "segredo-do-servidor" } });
    else social.mockRejectedValue(new Error("segredo-do-servidor"));
    render(<FacebookAuthButton />);

    fireEvent.click(screen.getByRole("button", { name: "Continuar com Facebook" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Tente novamente");
    expect(alert.textContent).not.toContain("segredo");
    expect((screen.getByRole("button", { name: "Continuar com Facebook" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("explica o limite de tentativas", async () => {
    social.mockResolvedValue({ error: { status: 429 } });
    render(<FacebookAuthButton />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar com Facebook" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Aguarde um minuto");
  });

  it("identifica indisponibilidade do serviço de contas em vez de atribuí-la ao Facebook", async () => {
    social.mockResolvedValue({ error: { status: 503 } });
    render(<FacebookAuthButton />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar com Facebook" }));
    expect((await screen.findByRole("alert")).textContent).toContain("O serviço de contas está indisponível");
  });
});
