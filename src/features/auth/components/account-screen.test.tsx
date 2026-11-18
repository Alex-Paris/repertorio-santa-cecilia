import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isAdmin: false }));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));
vi.mock("@/server/auth/session", () => ({
  lookupSession: async () => ({
    status: "ready",
    session: { user: { id: "u1", name: "Ana Teste", email: "ana@exemplo.org" }, expiresAt: new Date("2026-11-25T00:00:00Z") },
  }),
}));
vi.mock("@/server/catalog/catalog-service", () => ({ isCatalogAdmin: async () => mocks.isAdmin }));

import { AccountScreen } from "./account-screen";

async function renderAccount() {
  render(await AccountScreen());
}

beforeEach(() => {
  mocks.isAdmin = false;
});

describe("Minha conta (Etapa 2F.2B)", () => {
  it("agrupa as ações em seções: Conta, Biblioteca e repertórios, Contribuições", async () => {
    await renderAccount();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Conta",
      "Biblioteca e repertórios",
      "Contribuições",
    ]);
    const conta = screen.getByRole("region", { name: "Conta" });
    expect(within(conta).getByText("ana@exemplo.org")).toBeDefined();
    expect(within(conta).getByRole("button", { name: /Sair da conta/ })).toBeDefined();

    const biblioteca = screen.getByRole("region", { name: "Biblioteca e repertórios" });
    expect(within(biblioteca).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/biblioteca",
      "/repertorios",
      "/compartilhamentos",
      "/conta/importar-biblioteca-antiga",
    ]);
    const contribuicoes = screen.getByRole("region", { name: "Contribuições" });
    expect(within(contribuicoes).getByRole("link", { name: /Minhas sugestões/ }).getAttribute("href")).toBe("/conta/sugestoes");
  });

  it("a seção de administração só aparece para quem tem o papel, lido no servidor", async () => {
    await renderAccount();
    expect(screen.queryByRole("region", { name: "Administração" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Administrar catálogo/ })).toBeNull();
  });

  it("administração: catálogo, contribuições e liturgia juntos", async () => {
    mocks.isAdmin = true;
    await renderAccount();
    const admin = screen.getByRole("region", { name: "Administração" });
    expect(within(admin).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/admin/catalogo",
      "/admin/contribuicoes",
      "/admin/liturgia",
    ]);
  });
});
