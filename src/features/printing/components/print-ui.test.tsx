import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrintItem } from "../domain/print-model";
import { PrintDocument } from "./print-document";
import { PrintMenu } from "./print-menu";
import { PrintView } from "./print-view";

const SHORT = "[D]Vinde, povo de [G]Deus\n\n{start_of_chorus}\n[A]Glória ao Se[D]nhor\n{end_of_chorus}";
const LONG = Array.from({ length: 12 }, (_, i) => `[C]Estrofe ${i + 1}, [F]linha um\n[G]linha dois`).join("\n\n");

const items: PrintItem[] = [
  { id: "1", position: 1, moment: "entrada", label: "Entrada", title: "Hino Curto", artist: "Autora", printKey: "E", semitones: 2, chordPro: SHORT },
  { id: "2", position: 2, label: "Música 2", title: "Cântico Longo", artist: "Autor", printKey: "C", semitones: 0, chordPro: LONG },
  { id: "3", position: 3, moment: "comunhao", label: "Comunhão", title: "Ponte de Papel", artist: "", semitones: 0, unavailable: "no-content" },
];

function songs(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-print-song]")];
}

describe("folha: repertório só com letras", () => {
  it("mostra momento e título, a letra sem acordes e continua sem quebra de página", () => {
    const { container } = render(<PrintDocument format="lyrics" items={items} header={{ title: "Missa", lines: ["Cristo Rei"] }} />);
    expect(screen.getByRole("heading", { level: 2, name: "Entrada: Hino Curto" })).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: "Música 2: Cântico Longo" })).toBeDefined();
    expect(container.querySelector("[data-chord]")).toBeNull();
    expect(container.textContent).toContain("Vinde, povo de Deus");
    expect(container.textContent).toContain("Glória ao Senhor");
    expect(container.textContent).toContain("Refrão");
    expect(container.querySelector(".print-page-break")).toBeNull();
    expect(container.querySelector("[data-print-root]")?.getAttribute("data-print-format")).toBe("lyrics");
  });

  it("música sem conteúdo continua na ordem, com um aviso objetivo", () => {
    const { container } = render(<PrintDocument format="lyrics" items={items} />);
    const third = songs(container)[2]!;
    expect(third.textContent).toContain("Comunhão: Ponte de Papel");
    expect(within(third).getByText("Letra e cifra não disponíveis para impressão.")).toBeDefined();
  });
});

describe("folha: repertório com cifras", () => {
  it("cada música a partir da segunda começa numa nova folha; a primeira não", () => {
    const { container } = render(<PrintDocument format="chords" items={items} />);
    const blocks = songs(container);
    expect(blocks.map((block) => block.classList.contains("print-page-break"))).toEqual([false, true, true]);
  });

  it("mostra momento, título, autoria e o tom do item, com os acordes transpostos", () => {
    const { container } = render(<PrintDocument format="chords" items={items} />);
    const first = songs(container)[0]!;
    expect(first.textContent).toContain("Entrada");
    expect(first.textContent).toContain("Autora · Tom: E");
    // D +2 = E: o tom configurado no item.
    expect([...first.querySelectorAll("[data-chord]")].map((chord) => chord.textContent).filter(Boolean).slice(0, 2)).toEqual(["E", "A"]);
    // Uma música longa não é cortada: todas as estrofes ficam no mesmo bloco, que continua nas folhas seguintes.
    expect(songs(container)[1]!.textContent).toContain("Estrofe 12");
  });
});

describe("folha: música individual", () => {
  it("com cifra e só a letra, sem momento nem numeração", () => {
    const single: PrintItem = { ...items[0]!, label: "" };
    const { container, rerender } = render(<PrintDocument format="chords" items={[single]} single />);
    expect(screen.getByRole("heading", { level: 1, name: "Hino Curto" })).toBeDefined();
    expect(container.textContent).toContain("Tom: E");
    expect(container.querySelector("[data-chord]")).not.toBeNull();

    rerender(<PrintDocument format="lyrics" items={[single]} single />);
    expect(container.querySelector("[data-chord]")).toBeNull();
    expect(container.textContent).not.toContain("Tom:");
    expect(container.textContent).not.toContain("Entrada");
  });
});

describe("pré-visualização", () => {
  const print = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("print", print);
    print.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderView(onFormatChange = vi.fn()) {
    render(
      <PrintView
        heading="Imprimir repertório"
        name="Missa"
        back={{ href: "/repertorios/r1", label: "Missa" }}
        format="lyrics"
        formatLabels={{ lyrics: "Somente letras", chords: "Com cifras" }}
        onFormatChange={onFormatChange}
        items={items}
      />,
    );
    return onFormatChange;
  }

  it("mostra nome, quantidade, ordem, momentos, formato e o aviso das músicas sem conteúdo", () => {
    renderView();
    expect(screen.getByText(/· 3 músicas/)).toBeDefined();
    const order = screen.getByRole("list", { name: "Ordem das músicas" });
    expect(within(order).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "1Entrada: Hino Curto",
      "2Música 2: Cântico Longo",
      "3Comunhão: Ponte de PapelLetra e cifra não disponíveis para impressão.",
    ]);
    expect(screen.getByRole("status").textContent).toContain("1 música não tem letra ou cifra disponível");
    expect(screen.getByRole("radio", { name: "Somente letras" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("link", { name: "Voltar" }).getAttribute("href")).toBe("/repertorios/r1");
  });

  it("imprime pelo navegador e troca de formato sem sair da página", () => {
    const onFormatChange = renderView();
    fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    expect(print).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("radio", { name: "Com cifras" }));
    expect(onFormatChange).toHaveBeenCalledWith("chords");
  });

  it("os controles da tela ficam fora do papel", () => {
    renderView();
    const controls = screen.getByRole("button", { name: "Imprimir" }).closest("[data-print-hide]");
    expect(controls).not.toBeNull();
    expect(controls?.contains(document.querySelector("[data-print-root]"))).toBe(false);
  });
});

describe("menu Imprimir", () => {
  it("abre os formatos, fecha com Esc e devolve o foco", () => {
    render(<PrintMenu options={[{ label: "Com cifra", href: "/a" }, { label: "Somente letra", href: "/b" }]} />);
    const button = screen.getByRole("button", { name: /Imprimir/ });
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(button);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/a", "/b"]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link")).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});
