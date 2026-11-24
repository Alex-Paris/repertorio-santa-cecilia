import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminNavigation } from "./admin-navigation";

const route = vi.hoisted(() => ({ pathname: "/admin/catalogo" as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

describe("navegação administrativa", () => {
  it.each([
    ["/admin/catalogo/nova", "/admin/catalogo"],
    ["/admin/liturgia/celebracao-1", "/admin/liturgia"],
    ["/admin/contribuicoes/sugestao-1", "/admin/contribuicoes"],
    ["/admin/catalogo/importar", "/admin/catalogo/importar"],
    ["/admin/catalogo/qualidade", "/admin/catalogo/qualidade"],
  ])("marca somente a seção correta em %s", (pathname, href) => {
    route.pathname = pathname;
    render(<AdminNavigation />);
    const links = within(screen.getByRole("navigation", { name: "Navegação administrativa" })).getAllByRole("link");
    const current = links.filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute("href")).toBe(href);
  });
});
