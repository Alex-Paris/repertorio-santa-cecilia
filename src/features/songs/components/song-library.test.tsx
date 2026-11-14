import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { demoSongs } from "../data/demo-songs";
import { SongLibrary } from "./song-library";
import { versionedSongs } from "@/test/fixtures";

function search(value: string): void {
  fireEvent.change(screen.getByLabelText("Buscar por título ou artista"), { target: { value } });
}

describe("SongLibrary", () => {
  it("lista as músicas com link para a página de cada uma", () => {
    render(<SongLibrary songs={versionedSongs} />);
    expect(screen.getAllByRole("link")).toHaveLength(demoSongs.length);
    expect(screen.getByRole("link", { name: /Caminhos/ }).getAttribute("href")).toBe(
      "/musicas/song-caminhos",
    );
  });

  it("restringe a lista conforme a busca", () => {
    render(<SongLibrary songs={versionedSongs} />);
    search("estrada");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("1 música")).toBeDefined();
  });

  it("filtra por tipo e indica o filtro ativo", () => {
    render(<SongLibrary songs={versionedSongs} />);
    const filter = screen.getByRole("button", { name: "Link externo" });
    fireEvent.click(filter);
    expect(filter.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("Noite no Cais")).toBeDefined();
  });

  it("mostra estado vazio e permite limpar a busca", () => {
    render(<SongLibrary songs={versionedSongs} />);
    search("nada corresponde a isto");
    expect(screen.getByText("Nenhuma música encontrada")).toBeDefined();
    expect(screen.queryAllByRole("link")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Limpar busca e filtros" }));
    expect(screen.getAllByRole("link")).toHaveLength(demoSongs.length);
  });
});
