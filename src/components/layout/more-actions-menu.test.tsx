import { fireEvent, render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it } from "vitest";

import { MENU_ITEM_CLASS, MoreActionsMenu } from "./more-actions-menu";

function renderMenu() {
  render(
    <div>
      <MoreActionsMenu label="Mais ações da música">
        <Link href="/editar" className={MENU_ITEM_CLASS}>
          Editar
        </Link>
        <button type="button" className={MENU_ITEM_CLASS}>
          Excluir
        </button>
      </MoreActionsMenu>
      <p>Fora do menu</p>
    </div>,
  );
  return screen.getByRole("button", { name: "Mais ações da música" });
}

describe("menu Mais", () => {
  it("começa fechado: as ações secundárias não aparecem nem entram no Tab", () => {
    const button = renderMenu();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();
  });

  it("abre, fecha com Esc e devolve o foco ao botão", () => {
    const button = renderMenu();
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Editar" })).toBeDefined();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("fecha com um clique fora e ao seguir um link", () => {
    const button = renderMenu();
    fireEvent.click(button);
    fireEvent.pointerDown(screen.getByText("Fora do menu"));
    expect(button.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(button);
    fireEvent.click(screen.getByRole("link", { name: "Editar" }));
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("um botão que abre um diálogo mantém o menu aberto, e o diálogo não o fecha", () => {
    const button = renderMenu();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(button.getAttribute("aria-expanded")).toBe("true");

    // Com um diálogo na tela, cliques e Esc pertencem a ele.
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "alertdialog");
    document.body.append(dialog);
    fireEvent.pointerDown(dialog);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    dialog.remove();
  });
});
