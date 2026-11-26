import { clickReaderControl } from "@/test/reader-actions";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeAccount } from "@/test/fake-account-api";
import { openAccount } from "@/test/open-account";

import { READER_PREFERENCES_KEY, readerPreferencesStore } from "../data/reader-preferences-store";
import { DEFAULT_READER_PREFERENCES } from "../domain/reader-preferences";
import { ChordSheet } from "./chord-sheet";
import { PresentationStage } from "./presentation-stage";
import { SongDetailScreen } from "./song-detail-screen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

beforeEach(async () => {
  localStorage.clear();
  await openAccount();
  readerPreferencesStore.update(DEFAULT_READER_PREFERENCES);
  localStorage.removeItem(READER_PREFERENCES_KEY);
});

afterEach(() => {
  act(() => readerPreferencesStore.update(DEFAULT_READER_PREFERENCES));
});

function chords(root: ParentNode = document): string[] {
  return [...root.querySelectorAll("[data-chord]")].map((chord) => chord.textContent ?? "").filter(Boolean);
}

async function openCaminhos(context?: { repertoireId: string; itemId: string }) {
  render(<SongDetailScreen songId="song-caminhos" contextReference={context} />);
  await screen.findByRole("heading", { level: 1, name: "Caminhos" });
}

describe("modo Letra no leitor", () => {
  it("Cifra é o padrão; Letra tira os acordes e a transposição, sem mudar a música salva", async () => {
    const before = structuredClone(fakeAccount.library());
    await openCaminhos();
    expect(screen.getByRole("button", { name: "Cifra" }).getAttribute("aria-pressed")).toBe("true");
    expect(chords().length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Letra" }));
    expect(chords()).toEqual([]);
    expect(screen.getByText("Hoje vou seguir")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Aumentar um semitom" })).toBeNull();
    expect(document.body.textContent).not.toContain("Introdução");
    expect(fakeAccount.library()).toEqual(before);
  });

  it("ao voltar para Cifra, restaura o tom em que a pessoa estava", async () => {
    await openCaminhos();
    clickReaderControl("Aumentar um semitom");
    clickReaderControl("Aumentar um semitom");
    expect(chords().slice(0, 2)).toEqual(["A", "E"]);

    fireEvent.click(screen.getByRole("button", { name: "Letra" }));
    fireEvent.click(screen.getByRole("button", { name: "Cifra" }));
    expect(chords().slice(0, 2)).toEqual(["A", "E"]);
  });

  it("num repertório, alternar não mexe no tom salvo do item", async () => {
    await openCaminhos({ repertoireId: "rep-sarau-de-domingo", itemId: "item-sarau-caminhos" });
    const item = () =>
      fakeAccount.library().repertoires.find((r) => r.id === "rep-sarau-de-domingo")?.items.find((i) => i.id === "item-sarau-caminhos");
    const before = item()?.transposeSemitones;
    fireEvent.click(screen.getByRole("button", { name: "Letra" }));
    fireEvent.click(screen.getByRole("button", { name: "Cifra" }));
    expect(item()?.transposeSemitones).toBe(before);
  });

  it("o menu Imprimir leva às duas folhas, no tom da leitura", async () => {
    await openCaminhos();
    clickReaderControl("Aumentar um semitom");
    fireEvent.click(screen.getByRole("button", { name: /Imprimir/ }));
    expect(screen.getAllByRole("link", { name: /Com cifra|Somente letra/ }).map((link) => link.getAttribute("href"))).toEqual([
      "/musicas/song-caminhos/imprimir?modo=cifra&tom=1",
      "/musicas/song-caminhos/imprimir?modo=letra&tom=1",
    ]);
  });
});

describe("ChordSheet", () => {
  it("as duas leituras vêm do mesmo ChordPro; a cifra continua igual", () => {
    const source = "[C]Vem, Se[G]nhor\n[Am] [F]";
    const { container, rerender } = render(<ChordSheet source={source} />);
    expect(chords(container)).toEqual(["C", "G", "Am", "F"]);
    rerender(<ChordSheet source={source} mode="lyrics" />);
    expect(container.textContent).toBe("Vem, Senhor");
    rerender(<ChordSheet source="[C] [G]" mode="lyrics" />);
    expect(container.textContent).toContain("só acordes");
  });
});

describe("modo apresentação", () => {
  function present() {
    return render(
      <PresentationStage
        content={{ title: "Caminhos", artist: "Banda", originalKey: "G", chordPro: "[G]Hoje vou se[D]guir" }}
        semitones={0}
        navigation={null}
        returnLink={null}
        onSemitonesChange={() => undefined}
        onPrevious={() => undefined}
        onNext={() => undefined}
        onExit={() => undefined}
      />,
    );
  }

  it("fundo claro por padrão, independente do tema do site; o escuro é escolha e fica salvo", () => {
    document.documentElement.dataset.theme = "dark";
    present();
    const dialog = screen.getByRole("dialog");
    expect(dialog.classList.contains("presentation-light")).toBe(true);

    fireEvent.click(within(dialog).getByRole("button", { name: "Mostrar ajustes" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Escuro" }));
    expect(dialog.classList.contains("presentation-dark")).toBe(true);
    expect(JSON.parse(localStorage.getItem(READER_PREFERENCES_KEY) ?? "{}").presentationTheme).toBe("dark");
    delete document.documentElement.dataset.theme;
  });

  it("apresenta só a letra quando o modo é Letra, sem tom nem transposição", () => {
    act(() => readerPreferencesStore.update({ readingMode: "lyrics" }));
    present();
    const dialog = screen.getByRole("dialog");
    expect(chords(dialog)).toEqual([]);
    expect(within(dialog).getByRole("region", { name: "Letra" }).textContent).toContain("Hoje vou seguir");
    expect(dialog.querySelector("header")?.textContent).not.toContain("Tom");

    fireEvent.click(within(dialog).getByRole("button", { name: "Mostrar ajustes" }));
    expect(within(dialog).queryByRole("button", { name: "Aumentar um semitom" })).toBeNull();
    // Rolagem e fonte continuam disponíveis.
    expect(within(dialog).getByRole("button", { name: "Iniciar rolagem" })).toBeDefined();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cifra" }));
    expect(chords(dialog)).toEqual(["G", "D"]);
  });
});
