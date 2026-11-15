import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HeaderSearch } from "./header-search";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

describe("busca do cabeçalho", () => {
  it("fora do catálogo, leva à busca do catálogo", () => {
    pathname.value = "/preparar-missa";
    render(<HeaderSearch />);
    const field = screen.getByLabelText("Buscar músicas no catálogo por título ou autoria");
    expect(field.closest("form")?.getAttribute("action")).toBe("/catalogo");
  });

  it("na página do catálogo, dá lugar à busca da própria página (sem duas buscas iguais)", () => {
    pathname.value = "/catalogo";
    render(<HeaderSearch />);
    expect(screen.queryByRole("search")).toBeNull();
  });

  it("na página própria de uma música, continua disponível", () => {
    pathname.value = "/catalogo/cat-1";
    render(<HeaderSearch />);
    expect(screen.getByRole("search")).toBeDefined();
  });
});
