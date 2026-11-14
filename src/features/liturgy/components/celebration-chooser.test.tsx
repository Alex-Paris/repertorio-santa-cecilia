import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { editorialContext } from "@/test/liturgy-fixtures";

import { toCelebrationSummaryForTest } from "./celebration-chooser.fixtures";
import { CelebrationChooser, MassExplore } from "./celebration-chooser";

const KING = editorialContext("2026-11-22");

describe("escolha da missa", () => {
  it("mostra a celebração carregada: título, grau, ciclo, tempo e cor por extenso", () => {
    render(<CelebrationChooser date={KING.date} context={KING} />);
    const form = screen.getByRole("form", { name: "Escolher a missa" });

    expect(form.getAttribute("action")).toBe("/preparar-missa");
    expect((screen.getByLabelText("Data da celebração") as HTMLInputElement).value).toBe("2026-11-22");
    expect(within(form).getByText("Nosso Senhor Jesus Cristo, Rei do Universo")).toBeDefined();
    expect(within(form).getByText("Solenidade · Ano A")).toBeDefined();
    expect(within(form).getByText("Tempo Comum")).toBeDefined();
    expect(within(form).getByText("Branco")).toBeDefined();
    expect(within(form).getByRole("button", { name: /Preparar missa/ })).toBeDefined();
  });

  it("sem celebração carregada, só a data: nada é estimado", () => {
    render(<CelebrationChooser error="Informe uma data válida." />);
    expect(screen.queryByText("Celebração selecionada")).toBeNull();
    expect(screen.queryByText("Tempo litúrgico")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Informe uma data válida.");
  });
});

describe("atalhos de exploração", () => {
  it("celebrações vêm da base, com a selecionada marcada; tempos levam à busca de celebrações", () => {
    const next = [editorialContext("2026-11-15"), KING].map(toCelebrationSummaryForTest);
    render(<MassExplore upcoming={next} selectedId={KING.celebrationId} season="tempo-comum" />);

    const celebrations = screen.getByRole("region", { name: "Explorar por celebração" });
    const current = within(celebrations).getByRole("link", { name: /Nosso Senhor Jesus Cristo, Rei do Universo/ });
    expect(current.getAttribute("aria-current")).toBe("true");
    expect(current.getAttribute("href")).toBe(`/preparar-missa?data=2026-11-22&celebracao=${encodeURIComponent(KING.celebrationId)}`);
    expect(within(celebrations).getAllByRole("link")).toHaveLength(3);
    expect(within(celebrations).getByRole("link", { name: "Outras celebrações" }).getAttribute("href")).toBe("/celebracoes");

    const seasons = screen.getByRole("region", { name: "Explorar por tempo litúrgico" });
    expect(within(seasons).getAllByRole("link")).toHaveLength(6);
    const ordinary = within(seasons).getByRole("link", { name: /Tempo Comum/ });
    expect(ordinary.getAttribute("aria-current")).toBe("true");
    expect(ordinary.getAttribute("href")).toBe("/celebracoes?tempo=tempo-comum");
  });

  it("base vazia: só o atalho para buscar celebrações", () => {
    render(<MassExplore upcoming={[]} />);
    expect(within(screen.getByRole("region", { name: "Explorar por celebração" })).getAllByRole("link")).toHaveLength(1);
  });
});
