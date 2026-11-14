import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicShareSnapshot } from "../domain/public-share";
import { PublicShareView } from "./public-share-view";
import { PublicSongScreen } from "./public-song-screen";
import { ShareUnavailable } from "./share-unavailable";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

const TOKEN = `${"a".repeat(22)}.${"b".repeat(43)}`;
const id = (char: string): string => char.repeat(32);

const share: PublicShareSnapshot = {
  name: "Show Público",
  description: "Domingo à noite",
  items: [
    {
      id: id("a"),
      position: 1,
      title: "Com Cifra",
      artist: "Autora",
      originalKey: "G",
      transposeSemitones: 2,
      content: { kind: "chordpro", chordPro: "[G]Primeira linha" },
    },
    {
      id: id("b"),
      position: 2,
      title: "Sem Cifra",
      artist: "Terceiro",
      originalKey: "C",
      transposeSemitones: 0,
      content: { kind: "none" },
    },
    {
      id: id("c"),
      position: 3,
      title: "Externa",
      artist: "Site",
      originalKey: "D",
      transposeSemitones: 0,
      content: { kind: "external-link", sourceUrl: "https://example.com/cifra" },
    },
  ],
};

function openSong(itemId: string): void {
  render(<PublicSongScreen token={TOKEN} share={share} itemId={itemId} />);
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  router.replace.mockClear();
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("página pública do repertório", () => {
  beforeEach(() => {
    render(<PublicShareView token={TOKEN} share={share} />);
  });

  it("mostra nome, descrição e músicas na ordem publicada", () => {
    expect(screen.getByRole("heading", { level: 1, name: "Show Público" })).toBeDefined();
    expect(screen.getByText("Domingo à noite")).toBeDefined();

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Com Cifra"),
      expect.stringContaining("Sem Cifra"),
      expect.stringContaining("Externa"),
    ]);
  });

  it("mostra o tom publicado, com o deslocamento do item", () => {
    expect(within(screen.getAllByRole("listitem")[0]).getByText("A")).toBeDefined();
  });

  it("indica quais cifras estão disponíveis", () => {
    expect(screen.getByText("Cifra incluída")).toBeDefined();
    expect(screen.getByText("Sem cifra")).toBeDefined();
  });

  it("protege o link externo contra vazamento do endereço", () => {
    const link = screen.getByRole("link", { name: /Fonte original/ });

    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("não tem controles de edição nem links para áreas privadas", () => {
    expect(screen.queryByRole("button")).toBeNull();

    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      expect(href.startsWith(`/s/${TOKEN}/musicas/`) || href.startsWith("https://example.com")).toBe(true);
    }
  });
});

describe("leitor público", () => {
  it("exibe a cifra no tom publicado", () => {
    openSong(id("a"));

    expect(screen.getByRole("heading", { level: 1, name: "Com Cifra" })).toBeDefined();
    expect(screen.getByText("Primeira")).toBeDefined();
    expect(screen.getAllByText("A").length).toBeGreaterThan(0);
  });

  it("o ajuste de tom é temporário e não faz nenhuma requisição", () => {
    openSong(id("a"));

    fireEvent.click(screen.getByRole("button", { name: "Aumentar um semitom" }));

    expect(screen.getAllByText("A#").length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it("informa quando a cifra não foi incluída, sem controles de tom", () => {
    openSong(id("b"));

    expect(screen.getByText("Cifra não incluída")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Aumentar um semitom" })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("aponta para a fonte original de um link externo, sem incorporar conteúdo", () => {
    openSong(id("c"));

    const link = screen.getByRole("link", { name: /Abrir fonte original/ });
    expect(link.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("volta para a página do repertório publicado", () => {
    openSong(id("a"));

    expect(screen.getByRole("link", { name: "Show Público" }).getAttribute("href")).toBe(`/s/${TOKEN}`);
  });

  it("navega entre as músicas publicadas", () => {
    openSong(id("b"));

    expect(screen.getByRole("link", { name: "Anterior" }).getAttribute("href")).toBe(
      `/s/${TOKEN}/musicas/${id("a")}`,
    );
    expect(screen.getByRole("link", { name: "Próxima" }).getAttribute("href")).toBe(
      `/s/${TOKEN}/musicas/${id("c")}`,
    );
    expect(screen.getByText("Música 2 de 3")).toBeDefined();
  });

  it("trata um item desconhecido como link indisponível", () => {
    openSong(id("f"));

    expect(screen.getByText("Link indisponível")).toBeDefined();
  });
});

describe("modo apresentação público", () => {
  function present(): HTMLElement {
    fireEvent.click(screen.getByRole("button", { name: "Apresentar" }));
    return screen.getByRole("dialog");
  }

  it("apresenta a cifra sem gravar nada", () => {
    openSong(id("a"));
    const dialog = within(present());

    expect(dialog.getByText("Primeira")).toBeDefined();
    fireEvent.click(dialog.getByRole("button", { name: "Mostrar ajustes" }));
    fireEvent.click(dialog.getByRole("button", { name: "Aumentar um semitom" }));

    expect(dialog.getAllByText("A#").length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("não exibe anotações e aponta para a lista pública", () => {
    openSong(id("a"));
    const dialog = within(present());

    expect(dialog.queryByText("Anotações")).toBeNull();
    expect(dialog.getByRole("link", { name: /Voltar à lista/ }).getAttribute("href")).toBe(`/s/${TOKEN}`);
  });

  it("troca de música dentro da publicação", () => {
    openSong(id("a"));
    const dialog = within(present());

    fireEvent.click(dialog.getByRole("button", { name: "Próxima música" }));

    expect(dialog.getByRole("heading", { name: "Sem Cifra" })).toBeDefined();
    expect(dialog.getByText(/não foi incluída/)).toBeDefined();
    expect(window.location.pathname).toBe(`/s/${TOKEN}/musicas/${id("b")}`);
  });

  it("ao sair, a tela acompanha a música em apresentação", async () => {
    openSong(id("a"));
    const dialog = within(present());
    fireEvent.click(dialog.getByRole("button", { name: "Próxima música" }));

    await act(async () => {
      fireEvent.click(dialog.getByRole("button", { name: "Sair do modo apresentação" }));
    });

    expect(router.replace).toHaveBeenCalledWith(`/s/${TOKEN}/musicas/${id("b")}`);
  });
});

describe("link indisponível", () => {
  it("é uma mensagem genérica, sem dizer se existiu ou foi revogado", () => {
    render(<ShareUnavailable />);

    expect(screen.getByText("Este link não existe ou não está mais disponível.")).toBeDefined();
    expect(document.body.textContent).not.toMatch(/revogad/i);
  });
});
