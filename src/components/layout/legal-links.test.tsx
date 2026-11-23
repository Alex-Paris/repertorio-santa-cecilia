import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PublicShareLayout from "@/app/s/layout";
import { SANTA_CECILIA_CREDIT } from "@/components/brand/santa-cecilia";

import { AppShell } from "./app-shell";

vi.mock("./navigation", () => ({ TopNav: () => null, BottomNav: () => null }));
vi.mock("./account-menu", () => ({ AccountMenu: () => null }));
vi.mock("./header-search", () => ({ HeaderSearch: () => null }));
vi.mock("./theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("./toaster", () => ({ Toaster: () => null }));
vi.mock("./brand", () => ({ Brand: () => <span>Repertório Santa Cecília</span> }));

describe("links públicos no rodapé", () => {
  it.each([
    { name: "aplicação", Layout: AppShell },
    { name: "repertório compartilhado", Layout: PublicShareLayout },
  ])("oferece as três páginas na $name", ({ Layout }) => {
    render(<Layout><p>Conteúdo da página</p></Layout>);
    const footer = screen.getByRole("contentinfo");
    const nav = within(footer).getByRole("navigation", { name: "Privacidade e termos" });
    expect(within(nav).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Privacidade", "/privacidade"],
      ["Termos de uso", "/termos-de-uso"],
      ["Exclusão de dados", "/exclusao-de-dados"],
    ]);
    expect(footer.hasAttribute("data-print-hide")).toBe(true);
  });

  it("preserva o crédito da identidade visual", () => {
    render(<AppShell><p>Conteúdo da página</p></AppShell>);
    expect(within(screen.getByRole("contentinfo")).getByText(SANTA_CECILIA_CREDIT)).toBeDefined();
  });
});
