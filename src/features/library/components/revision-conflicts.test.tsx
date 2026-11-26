import { getRepertoireAction } from "@/test/repertoire-actions";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RepertoireDetailScreen } from "@/features/repertoires/components/repertoire-detail-screen";
import { RepertoireFormScreen } from "@/features/repertoires/components/repertoire-form-screen";
import { SongDetailScreen } from "@/features/songs/components/song-detail-screen";
import { SongFormScreen } from "@/features/songs/components/song-form-screen";
import type { SongInput } from "@/features/songs/domain/song";
import { toastStore } from "@/lib/utils/toast";
import { fakeAccount } from "@/test/fake-account-api";
import { openAccount } from "@/test/open-account";

import { accountLibrary } from "../data/browser-library";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

const SONG = "song-caminhos";
const ENSAIO = "rep-ensaio-acustico";

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label);
}

function toasts(): string[] {
  return toastStore.getSnapshot().map((toast) => toast.message);
}

function storedSong() {
  return fakeAccount.library().songs.find((song) => song.id === SONG)!;
}

function storedRepertoire(id = ENSAIO) {
  return fakeAccount.library().repertoires.find((repertoire) => repertoire.id === id)!;
}

/** Itens na ordem em que aparecem na tela. */
function orderedItems() {
  return [...storedRepertoire().items].sort((a, b) => a.position - b.position);
}

/** Outro dispositivo altera a música enquanto esta tela está aberta. */
async function otherDeviceEditsSong(title: string): Promise<void> {
  const song = storedSong();
  const input = { ...song, title } as unknown as SongInput & Record<string, unknown>;
  delete input.id;
  delete input.revision;
  delete input.createdAt;
  delete input.updatedAt;
  await fakeAccount.otherDevice().songs.update(SONG, input, song.revision);
}

beforeEach(async () => {
  localStorage.clear();
  router.push.mockClear();
  router.replace.mockClear();
  await openAccount();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("formulário de música em conflito", () => {
  async function editAndConflict(): Promise<void> {
    render(<SongFormScreen songId={SONG} />);
    await screen.findByRole("heading", { level: 1, name: "Editar música" });
    type("Título", "Meu Título");
    type("Cifra (ChordPro)", "[G]Meu rascunho importante");

    await otherDeviceEditsSong("Título do Outro Aparelho");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar música" }));
    });
    await screen.findByText("Esta música foi alterada em outro dispositivo enquanto você a editava.");
  }

  it("mantém o formulário e o rascunho, sem sucesso nem navegação", async () => {
    const before = toasts().length;

    await editAndConflict();

    expect(field("Título").value).toBe("Meu Título");
    expect(field("Cifra (ChordPro)").value).toContain("rascunho importante");
    expect(router.push).not.toHaveBeenCalled();
    expect(toasts().slice(before)).not.toContain("Música atualizada.");
    expect(storedSong().title).toBe("Título do Outro Aparelho");
  });

  it("não tenta salvar de novo sozinho", async () => {
    await editAndConflict();
    const writes = fakeAccount.fetch.mock.calls.filter(([, init]) => init?.method === "PUT").length;

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(fakeAccount.fetch.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(writes);
  });

  it("mostra a versão atual do servidor sem alterar o rascunho", async () => {
    await editAndConflict();

    fireEvent.click(screen.getByRole("button", { name: "Ver versão atual" }));

    expect(await screen.findByText("Título do Outro Aparelho")).toBeDefined();
    expect(field("Título").value).toBe("Meu Título");
  });

  it("copia o rascunho", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await editAndConflict();

    fireEvent.click(screen.getByRole("button", { name: "Copiar meu rascunho" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Meu rascunho importante")));
  });

  it("sem área de transferência, deixa o rascunho visível para copiar", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    await editAndConflict();

    fireEvent.click(screen.getByRole("button", { name: "Copiar meu rascunho" }));

    expect(((await screen.findByLabelText("Seu rascunho")) as HTMLTextAreaElement).value).toContain("Meu Título");
  });

  it("descartar exige confirmação; cancelar mantém o rascunho", async () => {
    await editAndConflict();

    fireEvent.click(screen.getByRole("button", { name: "Descartar rascunho" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    fireEvent.click(dialog.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(field("Título").value).toBe("Meu Título");
  });

  it("depois de descartar, carrega a versão atual e salva sobre ela", async () => {
    await editAndConflict();

    fireEvent.click(screen.getByRole("button", { name: "Descartar rascunho" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    fireEvent.click(dialog.getByRole("button", { name: "Descartar e carregar a versão atual" }));

    await waitFor(() => expect(field("Título").value).toBe("Título do Outro Aparelho"));
    type("Título", "Refeito Sobre a Atual");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar música" }));
    });

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(storedSong()).toMatchObject({ title: "Refeito Sobre a Atual", revision: 3 });
  });
});

describe("formulário de repertório em conflito", () => {
  it("mantém o rascunho e informa", async () => {
    render(<RepertoireFormScreen repertoireId={ENSAIO} />);
    await screen.findByRole("heading", { level: 1, name: "Editar repertório" });
    type("Nome", "Nome do Rascunho");

    const repertoire = storedRepertoire();
    await fakeAccount
      .otherDevice()
      .repertoires.update(ENSAIO, { name: "Nome do Outro", description: "" }, repertoire.revision);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar repertório" }));
    });

    expect(await screen.findByText(/Este repertório foi alterado em outro dispositivo/)).toBeDefined();
    expect(field("Nome").value).toBe("Nome do Rascunho");
    expect(storedRepertoire().name).toBe("Nome do Outro");
  });
});

describe("itens do repertório", () => {
  async function openEnsaio(): Promise<void> {
    render(<RepertoireDetailScreen repertoireId={ENSAIO} />);
    await screen.findByRole("heading", { level: 1 });
  }

  function openEditor(index = 0): void {
    fireEvent.click(getRepertoireAction(/^Ajustar tom e anotações/, index));
  }

  it("anotação com versão antiga detecta conflito e pode ser refeita sobre a atual", async () => {
    await openEnsaio();
    openEditor(1);
    const [first, second] = orderedItems();
    type("Anotações", "Minha anotação");

    await fakeAccount
      .otherDevice()
      .repertoires.updateItem(ENSAIO, first.id, { transposeSemitones: 4 }, storedRepertoire().revision);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar anotações" }));
    });

    expect(await screen.findByText(/alterado em outro dispositivo ou aba enquanto você editava/)).toBeDefined();
    expect(field("Anotações").value).toBe("Minha anotação");

    const resave = await screen.findByRole("button", { name: "Salvar sobre a versão atual" });
    // A pessoa confere a versão atual, já recarregada, antes de salvar de novo.
    await act(async () => {
      await accountLibrary.retry();
    });
    await act(async () => {
      fireEvent.click(resave);
    });

    await waitFor(() =>
      expect(storedRepertoire().items.find((item) => item.id === second.id)?.notes).toBe("Minha anotação"),
    );
    expect(storedRepertoire().items.find((item) => item.id === first.id)?.transposeSemitones).toBe(4);
  });

  it("cliques rápidos no tom não se perdem e mostram que estão sendo salvos", async () => {
    await openEnsaio();
    openEditor(0);
    const up = screen.getByRole("button", { name: "Aumentar um semitom" });
    const target = orderedItems()[0];
    const before = target.transposeSemitones;

    fireEvent.click(up);
    expect(screen.getByText("Salvando o tom…")).toBeDefined();
    fireEvent.click(up);
    fireEvent.click(up);

    await waitFor(() =>
      expect(orderedItems().find((item) => item.id === target.id)?.transposeSemitones).toBe(before + 3),
    );
    await waitFor(() => expect(screen.queryByText("Salvando o tom…")).toBeNull());
  });

  it("tom em conflito avisa e volta ao valor confirmado", async () => {
    await openEnsaio();
    openEditor(0);
    const first = orderedItems()[0];
    await fakeAccount
      .otherDevice()
      .repertoires.updateItem(ENSAIO, first.id, { transposeSemitones: -5 }, storedRepertoire().revision);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Aumentar um semitom" }));
    });

    await waitFor(() => expect(toasts().at(-1)).toMatch(/O tom não foi salvo/));
    expect(orderedItems()[0].transposeSemitones).toBe(-5);
  });

  it("reordenar com versão antiga não altera a ordem salva", async () => {
    await openEnsaio();
    const before = storedRepertoire().items.map((item) => item.id);
    await fakeAccount
      .otherDevice()
      .repertoires.update(ENSAIO, { name: "Outro nome", description: "" }, storedRepertoire().revision);

    const move = getRepertoireAction(/^Mover .* para baixo$/);
    await act(async () => {
      fireEvent.click(move);
    });

    await waitFor(() => expect(toasts().at(-1)).toMatch(/alterado em outro dispositivo/));
    expect(storedRepertoire().items.map((item) => item.id)).toEqual(before);
  });
});

describe("exclusão com versão antiga", () => {
  it("bloqueia e exige nova confirmação sobre a versão atual", async () => {
    const { demoSongs } = await import("@/features/songs/data/demo-songs");
    await openAccount({ songs: demoSongs.filter((entry) => entry.id === "song-noite-no-cais"), repertoires: [] });
    render(<SongDetailScreen songId="song-noite-no-cais" />);
    await screen.findByRole("heading", { level: 1 });
    const song = fakeAccount.library().songs.find((entry) => entry.id === "song-noite-no-cais")!;
    const input = { title: "Mudou", artist: song.artist, originalKey: song.originalKey, contentType: "external-link", sourceUrl: "https://example.com/x" } as const;
    await fakeAccount.otherDevice().songs.update(song.id, input, song.revision);

    fireEvent.click(screen.getByRole("button", { name: "Mais ações da música" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    await act(async () => {
      fireEvent.click(dialog.getByRole("button", { name: "Excluir música" }));
    });

    expect(await dialog.findByText(/alterado em outro dispositivo/)).toBeDefined();
    expect(fakeAccount.library().songs.some((entry) => entry.id === song.id)).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();

    // A tela recarrega a versão atual; a nova confirmação vale para ela.
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, hidden: true }).textContent).toBe("Mudou"));
    await act(async () => {
      fireEvent.click(dialog.getByRole("button", { name: "Excluir música" }));
    });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/biblioteca"));
    expect(fakeAccount.library().songs.some((entry) => entry.id === song.id)).toBe(false);
  });
});

describe("isolamento", () => {
  it("não mostra dados de outra conta no conflito", async () => {
    fakeAccount.signIn("outra", { songs: [{ ...storedSong(), title: "Segredo de Outra Conta" }], repertoires: [] });
    fakeAccount.signIn("user-a");

    render(<SongFormScreen songId={SONG} />);
    await screen.findByRole("heading", { level: 1, name: "Editar música" });
    await otherDeviceEditsSong("Alterada");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar música" }));
    });
    fireEvent.click(await screen.findByRole("button", { name: "Ver versão atual" }));

    await screen.findByText("Alterada");
    expect(document.body.textContent).not.toContain("Segredo de Outra Conta");
  });
});
