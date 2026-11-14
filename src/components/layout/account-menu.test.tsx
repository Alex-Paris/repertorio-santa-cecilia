import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountMenu } from "./account-menu";

beforeEach(() => {
  // O jsdom não tem `matchMedia`; o tema preferido do sistema é claro.
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});

describe("menu da conta", () => {
  it("abre com as páginas da conta, inclusive Minhas músicas, e fecha com Esc devolvendo o foco", () => {
    render(<AccountMenu />);
    const button = screen.getByRole("button", { name: "Conta" });
    expect(button.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Minhas músicas" }).getAttribute("href")).toBe("/biblioteca");
    expect(screen.getByRole("link", { name: "Minha conta" }).getAttribute("href")).toBe("/conta");
    expect(screen.getByRole("link", { name: "Links compartilhados" }).getAttribute("href")).toBe("/compartilhamentos");
    expect(screen.getByRole("button", { name: /Usar tema/ })).toBeDefined();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link", { name: "Minhas músicas" })).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("alterna o tema sem guardar dados da conta", () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Conta" }));
    const before = document.documentElement.getAttribute("data-theme");
    fireEvent.click(screen.getByRole("button", { name: /Usar tema/ }));
    expect(document.documentElement.getAttribute("data-theme")).not.toBe(before);
    expect(Object.keys(localStorage).filter((key) => key.includes("biblioteca"))).toEqual([]);
  });
});
