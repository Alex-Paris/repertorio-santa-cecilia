import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { editorialContext } from "@/test/liturgy-fixtures";

import { toCelebrationSummaryForTest } from "./celebration-chooser.fixtures";
import { MassExplore } from "./celebration-chooser";
import { HomeMassStart } from "./home-start";

const KING = toCelebrationSummaryForTest(editorialContext("2026-11-22"));
const NEXT = toCelebrationSummaryForTest(editorialContext("2026-11-29"));

describe("início: escolha da missa", () => {
  it("destaca a próxima celebração e leva à página da missa com a data já escolhida", () => {
    render(<HomeMassStart next={[KING, NEXT]} />);
    const card = screen.getByRole("region", { name: "Próxima celebração" });

    expect(within(card).getByText("Nosso Senhor Jesus Cristo, Rei do Universo")).toBeDefined();
    expect(within(card).getByText(/22 de novembro de 2026 · Solenidade/)).toBeDefined();
    expect(within(card).getByText("Tempo Comum")).toBeDefined();
    expect(within(card).getByText("Branco")).toBeDefined();
    const prepare = within(card).getByRole("link", { name: /Preparar esta missa/ });
    expect(prepare.getAttribute("href")).toBe(`/preparar-missa?data=2026-11-22&celebracao=${encodeURIComponent(KING.celebrationId)}`);

    // Outra data: formulário GET para a página da missa, sem JavaScript.
    const other = within(card).getByRole("form", { name: "Escolher outra data" });
    expect(other.getAttribute("action")).toBe("/preparar-missa");
    expect(within(other).getByLabelText("Outra data").getAttribute("name")).toBe("data");
  });

  it("não traz sugestões por momento nem o repertório em construção: isso fica na página da missa", () => {
    render(<HomeMassStart next={[KING]} />);
    expect(screen.queryByText(/Sugestões por momento/)).toBeNull();
    expect(screen.queryByText(/Músicas sugeridas/)).toBeNull();
    expect(screen.queryByText(/Repertório em construção/)).toBeNull();
  });

  it("sem celebração a partir de hoje, só a data, com um aviso honesto", () => {
    render(<HomeMassStart next={[]} />);
    expect(screen.queryByRole("region", { name: "Próxima celebração" })).toBeNull();
    expect(screen.getByRole("button", { name: "Preparar missa" })).toBeDefined();
    expect(screen.getByText(/Nenhuma celebração cadastrada a partir de hoje/)).toBeDefined();
  });

  it("calendário indisponível não é confundido com data sem celebração", () => {
    render(<HomeMassStart next={null} />);
    expect(screen.getByText(/Não foi possível consultar a base de celebrações/)).toBeDefined();
    expect(screen.queryByText(/Nenhuma celebração cadastrada/)).toBeNull();
  });
});

describe("início: atalhos empilhados", () => {
  it("destaca o tempo da próxima celebração, sem marcar nenhuma celebração como selecionada", () => {
    render(<MassExplore upcoming={[KING, NEXT]} season="tempo-comum" seasonNote="tempo da próxima celebração" stacked />);
    const celebrations = screen.getByRole("region", { name: "Explorar por celebração" });
    expect(within(celebrations).queryAllByRole("link", { current: true })).toHaveLength(0);
    const ordinary = within(screen.getByRole("region", { name: "Explorar por tempo litúrgico" })).getByRole("link", { name: /Tempo Comum/ });
    expect(ordinary.getAttribute("aria-current")).toBe("true");
    expect(ordinary.textContent).toContain("tempo da próxima celebração");
  });
});
