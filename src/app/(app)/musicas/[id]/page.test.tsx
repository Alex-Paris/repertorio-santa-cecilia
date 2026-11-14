import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { openAccount } from "@/test/open-account";

import SongPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }),
}));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

async function renderSong(id: string): Promise<void> {
  render(await SongPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }));
}

describe("página da música", () => {
  beforeEach(() => openAccount());

  it("exibe o estado de não encontrada para ID inexistente", async () => {
    await renderSong("nao-existe");
    expect(await screen.findByText("Música não encontrada")).toBeDefined();
  });

  it("exibe título, artista e cifra de uma música existente", async () => {
    await renderSong("song-caminhos");
    expect(await screen.findByRole("heading", { level: 1, name: "Caminhos" })).toBeDefined();
    expect(screen.getByText("Banda Exemplo")).toBeDefined();
    expect(screen.getAllByText("Em").length).toBeGreaterThan(0);
  });

  it("mostra o link para a fonte original sem incorporar conteúdo externo", async () => {
    await renderSong("song-noite-no-cais");
    const link = await screen.findByRole("link", { name: /Abrir fonte original/ });
    expect(link.getAttribute("href")).toBe("https://example.com/cifras/noite-no-cais");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(document.querySelector("iframe")).toBeNull();
  });
});
