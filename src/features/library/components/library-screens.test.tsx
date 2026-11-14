import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { demoSongs } from "@/features/songs/data/demo-songs";
import { toastStore } from "@/lib/utils/toast";
import { fakeAccount } from "@/test/fake-account-api";
import { apiError } from "@/test/fake-library-server";
import { openAccount } from "@/test/open-account";

import { songRepository } from "../data/browser-library";
import { LIBRARY_STORAGE_KEY } from "../data/library-storage";
import { parseLibraryBackup } from "../services/library-backup";
import { HomeOverview } from "./home-overview";
import { LibraryGate } from "./library-gate";

vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

beforeEach(async () => {
  localStorage.clear();
  await openAccount();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function lastToast(): string | undefined {
  return toastStore.getSnapshot().at(-1)?.message;
}

describe("carregamento", () => {
  it("mostra os dados depois de montar no cliente", async () => {
    render(<LibraryGate>{({ songs }) => <p>{songs.length} itens</p>}</LibraryGate>);
    expect(await screen.findByText(`${demoSongs.length} itens`)).toBeDefined();
  });

  it("atualiza a tela quando os dados mudam", async () => {
    render(<LibraryGate>{({ songs }) => <p>{songs.length} itens</p>}</LibraryGate>);
    await screen.findByText(`${demoSongs.length} itens`);

    await songRepository.create({
      title: "Mais uma",
      artist: "Pessoa",
      originalKey: "C",
      contentType: "original",
    });

    expect(await screen.findByText(`${demoSongs.length + 1} itens`)).toBeDefined();
  });
});

describe("página inicial", () => {
  it("mostra as contagens da conta", async () => {
    render(<HomeOverview />);
    const tile = await screen.findByRole("link", { name: /^\d+ ?Músicas$/ });
    expect(tile.textContent).toContain(String(demoSongs.length));
  });

  it("uma conta vazia não recebe dados de exemplo", async () => {
    await openAccount({ songs: [], repertoires: [] });

    render(<HomeOverview />);

    const tile = await screen.findByRole("link", { name: /^\d+ ?Músicas$/ });
    expect(tile.textContent).toContain("0");
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBeNull();
  });
});

describe("biblioteca antiga", () => {
  const stored = JSON.stringify({
    schemaVersion: 1,
    songs: [{ ...demoSongs[0], id: "s-antiga", updatedAt: "2026-05-05T00:00:00.000Z" }],
    repertoires: [],
  });

  it("avisa de forma discreta, sem importar nem bloquear", async () => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, stored);

    render(<HomeOverview />);

    expect(await screen.findByText(/Encontramos uma biblioteca antiga/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Revisar" }).getAttribute("href")).toBe(
      "/conta/importar-biblioteca-antiga",
    );
    expect(screen.getByRole("button", { name: "Exportar backup" })).toBeDefined();
    expect(fakeAccount.fetch.mock.calls.every(([, init]) => (init?.method ?? "GET") === "GET")).toBe(true);
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBe(stored);
  });

  it("pode ser dispensado, sem alterar os dados", async () => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, stored);
    render(<HomeOverview />);

    fireEvent.click(await screen.findByRole("button", { name: "Dispensar aviso" }));

    expect(screen.queryByText(/Encontramos uma biblioteca antiga/)).toBeNull();
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBe(stored);
  });

  it("não avisa quando só há os exemplos das versões anteriores", async () => {
    const { demoRepertoires } = await import("@/features/repertoires/data/demo-repertoires");
    localStorage.setItem(
      LIBRARY_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, songs: demoSongs, repertoires: demoRepertoires }),
    );

    render(<HomeOverview />);
    await screen.findByRole("button", { name: "Exportar backup" });

    expect(screen.queryByText(/Encontramos uma biblioteca antiga/)).toBeNull();
  });

  it("não avisa quando não há dados antigos", async () => {
    render(<HomeOverview />);
    await screen.findByRole("button", { name: "Exportar backup" });

    expect(screen.queryByText(/Encontramos uma biblioteca antiga/)).toBeNull();
  });
});

describe("backup da conta", () => {
  function captureDownload() {
    let exported: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      exported = blob;
      return "blob:backup";
    });
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    return { createObjectURL, text: () => exported?.text() };
  }

  it("busca um retrato completo no servidor, não o que está em memória", async () => {
    const download = captureDownload();
    render(<HomeOverview />);
    await screen.findByRole("button", { name: "Exportar backup" });

    const created = await songRepository.create({
      title: "Criada em outro aparelho",
      artist: "Pessoa",
      originalKey: "C",
      contentType: "original",
    });
    fakeAccount.library().songs.push({ ...created, id: "fora-do-cache", title: "Fora do cache" });

    fireEvent.click(screen.getByRole("button", { name: "Exportar backup" }));

    await waitFor(() => expect(download.createObjectURL).toHaveBeenCalled());
    const text = await download.text();
    expect(parseLibraryBackup(text ?? "")).toMatchObject({ status: "ok" });
    expect(text).toContain("Fora do cache");
    expect(lastToast()).toBe("Backup exportado.");
  });

  it("não inclui preferências do navegador", async () => {
    localStorage.setItem("repertorio-theme", "dark");
    const download = captureDownload();

    render(<HomeOverview />);
    fireEvent.click(await screen.findByRole("button", { name: "Exportar backup" }));

    await waitFor(() => expect(download.createObjectURL).toHaveBeenCalled());
    const text = await download.text();
    expect(text).not.toContain("repertorio-theme");
    expect(text).not.toContain('"dark"');
  });

  it("não anuncia sucesso quando a exportação falha", async () => {
    const download = captureDownload();
    render(<HomeOverview />);
    await screen.findByRole("button", { name: "Exportar backup" });

    fakeAccount.fail(() => apiError(503, "persistence_failed"));
    fireEvent.click(screen.getByRole("button", { name: "Exportar backup" }));

    await waitFor(() => expect(lastToast()).toMatch(/indisponível/));
    expect(download.createObjectURL).not.toHaveBeenCalled();
  });

  it("recusa uma resposta fora do formato de backup", async () => {
    const download = captureDownload();
    render(<HomeOverview />);
    await screen.findByRole("button", { name: "Exportar backup" });

    fakeAccount.fail(() => new Response(JSON.stringify({ backup: { schemaVersion: 1, songs: "x" } })));
    fireEvent.click(screen.getByRole("button", { name: "Exportar backup" }));

    await waitFor(() => expect(lastToast()).toMatch(/resposta inesperada/));
    expect(download.createObjectURL).not.toHaveBeenCalled();
  });
});
