import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChordSheet } from "./chord-sheet";

const SOURCE = `{title: Caminhos}
{key: G}

{comment: Introdução}

{start_of_chorus}
[G]Hoje vou se[Em7]guir
{end_of_chorus}`;

describe("ChordSheet", () => {
  it("não exibe marcações técnicas como texto", () => {
    const { container } = render(<ChordSheet source={SOURCE} />);
    expect(container.textContent).not.toMatch(/[{}[\]]/);
    expect(container.textContent).not.toContain("start_of_chorus");
  });

  it("destaca os acordes em elementos próprios, separados da letra", () => {
    const { container } = render(<ChordSheet source={SOURCE} />);
    const chords = [...container.querySelectorAll("[data-chord]")]
      .map((element) => element.textContent)
      .filter(Boolean);
    expect(chords).toEqual(["G", "Em7"]);
  });

  it("mantém o acorde na mesma coluna da sílaba em que ele cai", () => {
    const { container } = render(<ChordSheet source="se[D]guir" />);
    const chord = container.querySelector("[data-chord]:not(:empty)");
    expect(chord?.textContent).toBe("D");
    expect(chord?.nextElementSibling?.textContent).toBe("guir");
  });

  it("exibe comentários e o rótulo do refrão", () => {
    render(<ChordSheet source={SOURCE} />);
    expect(screen.getByText("Introdução")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Refrão" })).toBeDefined();
  });
});
