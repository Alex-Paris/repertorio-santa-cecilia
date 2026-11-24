import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { accountLibrary } from "@/features/library/data/browser-library";
import type { CatalogSongView } from "@/features/library/domain/library";
import { fakeAccount } from "@/test/fake-account-api";
import { openAccount, openSignedOut } from "@/test/open-account";

import { CatalogRepertoireDock } from "./catalog-repertoire-dock";
import { CatalogQuickFilters, catalogHref } from "./catalog-results";
import { CatalogSongDetail } from "./catalog-song-detail";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

const song = (id: string, title: string, key: "C" | "G"): CatalogSongView => ({
  id,
  title,
  artist: "Grupo Fictício",
  originalKey: key,
  contentType: "original",
  chordPro: `[${key}]Letra fictícia`,
  chordProAvailable: true,
});
const A = song("cat-a", "Canto Fictício A", "C");
const B = song("cat-b", "Canto Fictício B", "G");

const writes = () =>
  fakeAccount.fetch.mock.calls.filter(([, init]) => init?.method && init.method !== "GET").map(([url, init]) => [init?.method, String(url)]);

async function accountWithRepertoire() {
  await openAccount({ songs: [], repertoires: [] });
  fakeAccount.setCatalog([A, B]);
  const devices = fakeAccount.otherDevice();
  let repertoire = await devices.repertoires.create({ name: "Ensaio fictício", description: "" });
  repertoire = await devices.repertoires.addSong(repertoire.id, A.id, repertoire.revision, "catalog");
  repertoire = await devices.repertoires.addSong(repertoire.id, B.id, repertoire.revision, "catalog");
  await openAccount(fakeAccount.library());
  fakeAccount.setCatalog([A, B]);
  // A conta recarrega e o servidor resolve as músicas do catálogo usadas pelo repertório.
  await accountLibrary.retry();
  await waitFor(() => {
    const snapshot = accountLibrary.getSnapshot();
    expect(snapshot.status === "ready" && snapshot.library.catalogSongs.length).toBe(2);
  });
  return repertoire;
}

const stored = () => fakeAccount.library().repertoires[0];

beforeEach(() => {
  router.replace.mockClear();
  cleanup();
});

describe("endereço do catálogo", () => {
  it("guarda busca, filtros, página, música e repertório, nessa ordem", () => {
    expect(catalogHref({ query: "", filters: {} })).toBe("/catalogo");
    expect(
      catalogHref({ query: "mesa", filters: { moment: "comunhao" }, page: 2, selected: "cat-a", repertoireId: "rep-1" }),
    ).toBe("/catalogo?q=mesa&momento=comunhao&page=2&musica=cat-a&repertorio=rep-1");
  });

  it("filtros rápidos: só classificações existentes; o ativo pode ser retirado", () => {
    render(
      <CatalogQuickFilters
        location={{ query: "pão", filters: { season: "quaresma" }, repertoireId: "rep-1" }}
        facets={{ moments: [{ id: "comunhao", count: 4 }], seasons: [{ id: "quaresma", count: 2 }], celebrations: [], themes: [] }}
      />,
    );
    const active = screen.getByRole("link", { name: "Retirar o filtro Quaresma" });
    expect(active.getAttribute("aria-current")).toBe("true");
    expect(active.getAttribute("href")).toBe("/catalogo?q=p%C3%A3o&repertorio=rep-1");
    expect(screen.getByRole("link", { name: "Filtrar por Comunhão" }).getAttribute("href")).toBe(
      "/catalogo?q=p%C3%A3o&momento=comunhao&tempo=quaresma&repertorio=rep-1",
    );
    // Sem celebrações nem temas classificados, nenhum atalho é inventado.
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("sem classificações nem filtros, a fileira de atalhos não aparece", () => {
    const { container } = render(
      <CatalogQuickFilters location={{ query: "", filters: {} }} facets={{ moments: [], seasons: [], celebrations: [], themes: [] }} />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("repertório atual ao lado do catálogo", () => {
  it("visitante é convidado a entrar, sem dados de conta", async () => {
    await openSignedOut();
    render(<CatalogRepertoireDock repertoireId={null} locationHref="/catalogo" addMore="search" />);
    const panel = screen.getByRole("region", { name: "Repertório atual" });
    expect(await within(panel).findByRole("link", { name: "Entrar" })).toBeDefined();
    expect(writes()).toEqual([]);
  });

  it("mostra o repertório alterado mais recentemente e reordena com a revisão carregada", async () => {
    const repertoire = await accountWithRepertoire();
    render(<CatalogRepertoireDock repertoireId={null} locationHref="/catalogo?q=canto" addMore="search" />);
    const panel = screen.getByRole("region", { name: "Repertório atual" });
    await within(panel).findByText("Canto Fictício A");

    fireEvent.click(within(panel).getByRole("button", { name: "Descer Canto Fictício A" }));
    await waitFor(() => expect(stored().items.map((item) => item.songId)).toEqual([B.id, A.id]));
    expect(writes().at(-1)).toEqual(["POST", `/api/v1/library/repertoires/${repertoire.id}/items/${repertoire.items[0].id}/move`]);
    expect(within(panel).getByRole("button", { name: "Subir Canto Fictício B" })).toHaveProperty("disabled", true);
  });

  it("ajusta o tom do item e remove a música, sem tocar no catálogo", async () => {
    await accountWithRepertoire();
    render(<CatalogRepertoireDock repertoireId={null} locationHref="/catalogo" addMore="search" />);
    const panel = screen.getByRole("region", { name: "Repertório atual" });
    await within(panel).findByText("Canto Fictício B");

    fireEvent.click(within(panel).getByRole("button", { name: "Aumentar um semitom de Canto Fictício B" }));
    await waitFor(() => expect(stored().items.find((item) => item.songId === B.id)?.transposeSemitones).toBe(1));

    fireEvent.click(within(panel).getByRole("button", { name: "Remover Canto Fictício A do repertório" }));
    await waitFor(() => expect(stored().items.map((item) => item.songId)).toEqual([B.id]));
    expect(B.originalKey).toBe("G");
  });

  it("trocar de repertório mantém a busca no endereço", async () => {
    const repertoire = await accountWithRepertoire();
    render(<CatalogRepertoireDock repertoireId={null} locationHref="/catalogo?q=canto" addMore="search" />);
    const panel = screen.getByRole("region", { name: "Repertório atual" });
    fireEvent.click(await within(panel).findByRole("button", { name: "Trocar de repertório" }));
    fireEvent.click(within(panel).getByRole("button", { name: /Ensaio fictício/ }));
    expect(router.replace).toHaveBeenCalledWith(`/catalogo?q=canto&repertorio=${repertoire.id}`, { scroll: false });
  });
});

describe("música aberta no painel central", () => {
  it("adicionar já sugere o repertório atual; a escolha continua explícita fora do catálogo", async () => {
    const repertoire = await accountWithRepertoire();
    render(<CatalogSongDetail song={A} headingLevel={2} currentRepertoire={{ repertoireId: null }} contained />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao repertório" }));
    expect(((await screen.findByLabelText("Repertório")) as HTMLSelectElement).value).toBe(repertoire.id);

    cleanup();
    render(<CatalogSongDetail song={A} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao repertório" }));
    expect(((await screen.findByLabelText("Repertório")) as HTMLSelectElement).value).toBe("");
  });

  it("controles de leitura numa barra própria sobre a cifra; a restauração do tom só aparece depois de transpor", () => {
    render(<CatalogSongDetail song={B} headingLevel={2} contained />);
    expect(screen.getByRole("heading", { level: 2, name: "Canto Fictício B" })).toBeDefined();
    const controls = screen.getByRole("group", { name: "Controles da cifra" });
    expect(within(controls).getByRole("group", { name: "Tom de leitura" })).toBeDefined();
    expect(within(controls).getByRole("group", { name: "Tamanho da fonte" })).toBeDefined();
    // Adicionar e apresentar ficam no cabeçalho da música, fora da barra presa.
    expect(within(controls).queryByRole("button", { name: "Adicionar ao repertório" })).toBeNull();
    expect(screen.getByRole("button", { name: "Apresentar" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Restaurar tom original" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Aumentar um semitom" }));
    fireEvent.click(screen.getByRole("button", { name: "Restaurar tom original" }));
    expect(screen.queryByRole("button", { name: "Restaurar tom original" })).toBeNull();
  });

  it("sem link de vídeo, só uma indicação compacta: sem player, miniatura, partitura ou PDF", () => {
    render(<CatalogSongDetail song={A} />);
    expect(screen.getByText("Sem vídeo de referência")).toBeDefined();
    expect(screen.queryByRole("button", { name: /vídeo/i })).toBeNull();
    expect(document.querySelector("iframe, img[src*='ytimg']")).toBeNull();
    expect(screen.queryByText(/Partitura|PDF/)).toBeNull();
  });

  it("trocar a referência fecha o player anterior e exige novo clique para carregar", () => {
    const { rerender } = render(<CatalogSongDetail song={{ ...A, video: { provider: "youtube", videoId: "abcdefghijk" } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Referência em vídeo" }));
    fireEvent.click(screen.getByRole("button", { name: "Carregar vídeo de Canto Fictício A" }));
    expect(document.querySelector("iframe")).not.toBeNull();

    rerender(<CatalogSongDetail song={{ ...A, video: { provider: "youtube", videoId: "lmnopqrstuv" } }} />);
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Referência em vídeo" }));
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Carregar vídeo de Canto Fictício A" }));
    expect(document.querySelector("iframe")?.src).toContain("/embed/lmnopqrstuv");
  });
});
