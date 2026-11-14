import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { demoSongs } from "@/features/songs/data/demo-songs";
import { apiError } from "@/test/fake-library-server";
import { fakeAccount } from "@/test/fake-account-api";
import { openAccount, openSignedOut } from "@/test/open-account";

import { accountLibrary } from "../data/browser-library";
import { LIBRARY_STORAGE_KEY } from "../data/library-storage";
import { LibraryGate } from "./library-gate";

vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

function renderGate(): void {
  render(
    <LibraryGate>
      {({ songs }) => <p data-testid="conteudo">{songs.map((song) => song.title).join(",") || "vazia"}</p>}
    </LibraryGate>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sem sessão", () => {
  it("oferece entrar e criar conta, sem conteúdo privado", async () => {
    await openSignedOut();

    renderGate();

    expect(await screen.findByText("Entre para acessar sua biblioteca")).toBeDefined();
    expect(screen.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe("/entrar");
    expect(screen.getByRole("link", { name: "Criar conta" }).getAttribute("href")).toBe("/cadastro");
    expect(screen.queryByTestId("conteudo")).toBeNull();
  });

  it("não mostra dados antigos deste navegador", async () => {
    localStorage.setItem(
      LIBRARY_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, songs: [demoSongs[0]], repertoires: [] }),
    );
    await openSignedOut();

    renderGate();

    await screen.findByText("Entre para acessar sua biblioteca");
    expect(document.body.textContent).not.toContain(demoSongs[0].title);
    localStorage.clear();
  });
});

describe("com sessão", () => {
  it("renderiza no servidor apenas o carregamento", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    const html = renderToString(<LibraryGate>{() => <p>conteúdo</p>}</LibraryGate>);

    expect(html).toContain("Carregando");
    expect(html).not.toContain("conteúdo");
    expect(getItem).not.toHaveBeenCalled();
  });

  it("mostra a biblioteca da conta", async () => {
    await openAccount({ songs: [{ ...demoSongs[0], title: "Só na conta" }], repertoires: [] });

    renderGate();

    expect((await screen.findByTestId("conteudo")).textContent).toBe("Só na conta");
  });

  it("depois do logout, os dados saem da tela", async () => {
    await openAccount({ songs: [{ ...demoSongs[0], title: "Privada" }], repertoires: [] });
    renderGate();
    await screen.findByTestId("conteudo");

    await waitFor(() => {
      accountLibrary.prepareSignOut();
      expect(screen.queryByTestId("conteudo")).toBeNull();
    });

    expect(document.body.textContent).not.toContain("Privada");
  });
});

describe("indisponibilidade", () => {
  it("explica a falha e não usa lista vazia nem dados locais", async () => {
    localStorage.setItem(
      LIBRARY_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, songs: [demoSongs[0]], repertoires: [] }),
    );
    await openAccount({ songs: [], repertoires: [] });
    fakeAccount.fail(() => apiError(503, "persistence_failed"));
    await accountLibrary.retry();
    fakeAccount.fail(() => apiError(503, "persistence_failed"));
    accountLibrary.prepareSignOut();
    await accountLibrary.checkSession();

    renderGate();

    expect(await screen.findByText("Biblioteca indisponível")).toBeDefined();
    expect(screen.queryByTestId("conteudo")).toBeNull();

    fakeAccount.fail(null);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect((await screen.findByTestId("conteudo")).textContent).toBe("vazia");
    localStorage.clear();
  });

  it("pede novo login quando a sessão expira", async () => {
    await openAccount({ songs: [], repertoires: [] });
    renderGate();
    await screen.findByTestId("conteudo");

    fakeAccount.signOut();
    await accountLibrary.retry();

    expect(await screen.findByText("Sua sessão expirou")).toBeDefined();
    expect(screen.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe("/entrar");
    expect(screen.queryByTestId("conteudo")).toBeNull();
  });
});
