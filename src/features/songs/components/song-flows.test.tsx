import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toastStore } from "@/lib/utils/toast";
import { fakeAccount } from "@/test/fake-account-api";
import { openAccount } from "@/test/open-account";

import { SongDetailScreen } from "./song-detail-screen";
import { SongFormScreen } from "./song-form-screen";
import { SongLibraryScreen } from "./song-library-screen";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  bfcacheId: "teste",
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

beforeEach(async () => {
  await openAccount();
  vi.restoreAllMocks();
  router.push.mockClear();
  router.replace.mockClear();
});

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function storedSongs(): { id: string; title: string; chordPro?: string }[] {
  return fakeAccount.library().songs as { id: string; title: string; chordPro?: string }[];
}

function lastToast(): string | undefined {
  return toastStore.getSnapshot().at(-1)?.message;
}

async function openNewSongForm(): Promise<void> {
  render(<SongFormScreen />);
  await screen.findByRole("heading", { level: 1, name: "Nova música" });
}

async function createSong(chordPro = "[G]Olá"): Promise<string> {
  await openNewSongForm();
  type("Título", "Canção Nova");
  type("Artista", "Pessoa");
  type("Cifra (ChordPro)", chordPro);
  fireEvent.click(screen.getByRole("button", { name: "Salvar música" }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  cleanup();
  return String(router.push.mock.calls[0][0]).replace("/musicas/", "");
}

describe("cadastro de música", () => {
  it("cria a música e leva à sua página, confirmando o salvamento", async () => {
    const id = await createSong();

    expect(router.push).toHaveBeenCalledWith(`/musicas/${id}`);
    expect(lastToast()).toBe("Música cadastrada.");
    expect(storedSongs().some((song) => song.title === "Canção Nova")).toBe(true);
  });

  it("reabre a música salva pela URL", async () => {
    const id = await createSong();

    render(<SongDetailScreen songId={id} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Canção Nova" })).toBeDefined();
    expect(screen.getByText("Pessoa")).toBeDefined();
    expect(screen.getByText("Olá")).toBeDefined();
  });

  it("encontra a nova música na biblioteca", async () => {
    await createSong();

    render(<SongLibraryScreen />);

    expect(await screen.findByRole("link", { name: /Canção Nova/ })).toBeDefined();
  });

  it("mostra erros de validação e não salva", async () => {
    await openNewSongForm();
    const songsBefore = storedSongs().length;

    fireEvent.click(screen.getByRole("button", { name: "Salvar música" }));

    expect(screen.getByText("Informe o título.")).toBeDefined();
    expect(screen.getByText("Informe o artista.")).toBeDefined();
    expect(screen.getByLabelText("Título").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Título"));
    expect(router.push).not.toHaveBeenCalled();
    expect(storedSongs()).toHaveLength(songsBefore);
  });

  it("troca os campos conforme o tipo e valida o link externo", async () => {
    await openNewSongForm();
    type("Título", "Link");
    type("Artista", "Pessoa");
    type("Tipo de conteúdo", "external-link");

    expect(screen.queryByLabelText("Cifra (ChordPro)")).toBeNull();

    type("Link da fonte original", "javascript:alert(1)");
    fireEvent.click(screen.getByRole("button", { name: "Salvar música" }));

    expect(
      screen.getByText("Use um link completo, começando com http:// ou https://."),
    ).toBeDefined();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("não informa sucesso quando a gravação falha", async () => {
    await openNewSongForm();
    type("Título", "Sem espaço");
    type("Artista", "Pessoa");
    const toastsBefore = toastStore.getSnapshot().length;
    fakeAccount.fail(() => new Response(JSON.stringify({ error: { code: "x", message: "x" } }), { status: 503 }));

    fireEvent.click(screen.getByRole("button", { name: "Salvar música" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível confirmar");
    expect(router.push).not.toHaveBeenCalled();
    expect(toastStore.getSnapshot()).toHaveLength(toastsBefore);
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("Sem espaço");
  });
});

describe("editor de cifras", () => {
  it("mostra a prévia interpretada, sem as marcações técnicas", async () => {
    await openNewSongForm();

    type("Cifra (ChordPro)", "{title: X}\n[G]Hoje vou se[D]guir");

    const preview = within(screen.getByRole("region", { name: "Prévia da cifra" }));
    expect(await preview.findByText("G")).toBeDefined();
    expect(preview.getByText("D")).toBeDefined();
    expect(preview.getByText("guir")).toBeDefined();
    expect(screen.getByRole("region", { name: "Prévia da cifra" }).textContent).not.toContain("[");
  });

  it("salva quebras de linha e marcações exatamente como digitadas", async () => {
    const source = "{title: X}\n\n[G]Linha um\n\n\n[D]Linha dois  ";

    await createSong(source);

    expect(storedSongs().find((song) => song.title === "Canção Nova")?.chordPro).toBe(source);
  });
});

describe("edição de música", () => {
  it("abre com os dados atuais e salva a alteração da cifra", async () => {
    render(<SongFormScreen songId="song-caminhos" />);
    const title = (await screen.findByLabelText("Título")) as HTMLInputElement;
    expect(title.value).toBe("Caminhos");

    type("Cifra (ChordPro)", "[C]Cifra revisada");
    fireEvent.click(screen.getByRole("button", { name: "Salvar música" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/musicas/song-caminhos"));
    cleanup();

    render(<SongDetailScreen songId="song-caminhos" />);
    const sheet = await screen.findByRole("article");
    expect(sheet.textContent).toContain("Cifra revisada");
  });

  it("mostra estado adequado ao editar música inexistente", async () => {
    render(<SongFormScreen songId="nao-existe" />);
    expect(await screen.findByText("Música não encontrada")).toBeDefined();
  });
});

describe("exclusão de música", () => {
  async function requestDeletion(): Promise<ReturnType<typeof within>> {
    // Excluir fica no menu "Mais" da página da música.
    fireEvent.click(await screen.findByRole("button", { name: "Mais ações da música" }));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    return within(await screen.findByRole("alertdialog"));
  }

  it("só exclui após confirmação explícita", async () => {
    const id = await createSong();
    render(<SongDetailScreen songId={id} />);

    const dialog = await requestDeletion();
    expect(storedSongs().some((song) => song.id === id)).toBe(true);

    fireEvent.click(dialog.getByRole("button", { name: "Excluir música" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/biblioteca"));
    expect(lastToast()).toBe("Música excluída.");
    expect(storedSongs().some((song) => song.id === id)).toBe(false);
  });

  it("mantém a música quando a confirmação é cancelada", async () => {
    const id = await createSong();
    render(<SongDetailScreen songId={id} />);

    const dialog = await requestDeletion();
    fireEvent.click(dialog.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(storedSongs().some((song) => song.id === id)).toBe(true);
  });

  it("explica o bloqueio e lista os repertórios que usam a música", async () => {
    render(<SongDetailScreen songId="song-coracao-de-vento" />);

    const dialog = await requestDeletion();

    expect(dialog.getByText("Esta música não pode ser excluída")).toBeDefined();
    expect(dialog.getByRole("link", { name: "Sarau de Domingo" }).getAttribute("href")).toBe(
      "/repertorios/rep-sarau-de-domingo",
    );
    expect(dialog.getByRole("link", { name: "Ensaio Acústico" })).toBeDefined();
    expect(dialog.queryByRole("button", { name: "Excluir música" })).toBeNull();
    expect(storedSongs().some((song) => song.id === "song-coracao-de-vento")).toBe(true);
  });
});
