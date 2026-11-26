import { getRepertoireAction } from "@/test/repertoire-actions";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toastStore } from "@/lib/utils/toast";
import { fakeAccount } from "@/test/fake-account-api";
import { openAccount } from "@/test/open-account";

import { RepertoireDetailScreen } from "./repertoire-detail-screen";
import { RepertoireFormScreen } from "./repertoire-form-screen";
import { RepertoireListScreen } from "./repertoire-list-screen";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  bfcacheId: "teste",
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

const ENSAIO = "rep-ensaio-acustico";

beforeEach(async () => {
  await openAccount();
  router.push.mockClear();
  router.replace.mockClear();
});

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function lastToast(): string | undefined {
  return toastStore.getSnapshot().at(-1)?.message;
}

function storedRepertoires(): { id: string; name: string }[] {
  return fakeAccount.library().repertoires;
}

function renderedTitles(): (string | null)[] {
  return within(screen.getByRole("list"))
    .getAllByRole("listitem")
    .map((row) => row.querySelector("p")?.textContent ?? null);
}

async function openEnsaio(): Promise<void> {
  render(<RepertoireDetailScreen repertoireId={ENSAIO} />);
  await screen.findByRole("heading", { level: 1, name: "Ensaio Acústico" });
}

describe("criação de repertório", () => {
  it("cria e abre o repertório, que aparece na listagem", async () => {
    render(<RepertoireFormScreen />);
    await screen.findByRole("heading", { level: 1, name: "Novo repertório" });

    type("Nome", "Show de Sábado");
    type("Descrição (opcional)", "Lista principal");
    fireEvent.click(screen.getByRole("button", { name: "Salvar repertório" }));

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(lastToast()).toBe("Repertório criado.");
    const id = String(router.push.mock.calls[0][0]).replace("/repertorios/", "");
    cleanup();

    render(<RepertoireDetailScreen repertoireId={id} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Show de Sábado" })).toBeDefined();
    expect(screen.getByText("Nenhuma música neste repertório")).toBeDefined();
    cleanup();

    render(<RepertoireListScreen />);
    expect(await screen.findByRole("link", { name: /Show de Sábado/ })).toBeDefined();
  });

  it("exige o nome", async () => {
    render(<RepertoireFormScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Salvar repertório" }));

    expect(screen.getByText("Informe o nome do repertório.")).toBeDefined();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("edição de repertório", () => {
  it("altera nome e descrição", async () => {
    render(<RepertoireFormScreen repertoireId={ENSAIO} />);
    expect(((await screen.findByLabelText("Nome")) as HTMLInputElement).value).toBe(
      "Ensaio Acústico",
    );

    type("Nome", "Ensaio Geral");
    fireEvent.click(screen.getByRole("button", { name: "Salvar repertório" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/repertorios/${ENSAIO}`));
    expect(storedRepertoires().find((r) => r.id === ENSAIO)?.name).toBe("Ensaio Geral");
  });

  it("mostra estado adequado para ID inexistente", async () => {
    render(<RepertoireDetailScreen repertoireId="nao-existe" />);
    expect(await screen.findByText("Repertório não encontrado")).toBeDefined();
  });
});

// Desde a Etapa 2E.1 o catálogo é a origem padrão; músicas particulares ficam em "Minhas músicas".
// Com músicas na lista, a busca para adicionar abre pelo botão "Adicionar músicas".
function choosePersonalSongs(): void {
  fireEvent.click(screen.getByRole("button", { name: "Adicionar músicas" }));
  fireEvent.click(screen.getByRole("radio", { name: "Minhas músicas" }));
}

describe("músicas do repertório", () => {
  it("adiciona uma música existente e reflete na lista", async () => {
    await openEnsaio();
    choosePersonalSongs();

    type("Adicionar música particular", "song-caminhos");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() => expect(renderedTitles()).toContain("Caminhos"));
    expect(lastToast()).toBe("“Caminhos” adicionada ao repertório.");
  });

  it("não oferece músicas que já estão no repertório", async () => {
    await openEnsaio();
    choosePersonalSongs();

    const options = within(screen.getByLabelText("Adicionar música particular")).getAllByRole("option");
    const labels = options.map((option) => option.textContent);

    expect(labels.some((label) => label?.startsWith("Coração de Vento"))).toBe(false);
    expect(labels.some((label) => label?.startsWith("Caminhos"))).toBe(true);
  });

  it("pede a escolha de uma música antes de adicionar", async () => {
    await openEnsaio();
    choosePersonalSongs();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(screen.getByRole("alert").textContent).toContain("Escolha uma música");
  });

  it("remove a música do repertório", async () => {
    await openEnsaio();

    fireEvent.click(getRepertoireAction("Remover Maré de Setembro do repertório"));

    await waitFor(() => expect(renderedTitles()).toEqual(["Estrada de Terra", "Coração de Vento"]));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mais ações de Coração de Vento" }));
  });

  it("reordena com controles acessíveis e persiste ao reabrir", async () => {
    await openEnsaio();
    expect(renderedTitles()).toEqual(["Estrada de Terra", "Maré de Setembro", "Coração de Vento"]);

    fireEvent.click(getRepertoireAction("Mover Coração de Vento para cima"));

    await waitFor(() =>
      expect(renderedTitles()).toEqual(["Estrada de Terra", "Coração de Vento", "Maré de Setembro"]),
    );
    cleanup();

    await openEnsaio();
    expect(renderedTitles()).toEqual(["Estrada de Terra", "Coração de Vento", "Maré de Setembro"]);
  });

  it("desativa os movimentos impossíveis nas pontas da lista", async () => {
    await openEnsaio();

    expect(
      (getRepertoireAction("Mover Estrada de Terra para cima") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (getRepertoireAction("Mover Coração de Vento para baixo") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("mantém o foco do teclado no controle após mover", async () => {
    await openEnsaio();
    const button = getRepertoireAction("Mover Estrada de Terra para baixo");
    button.focus();

    fireEvent.click(button);

    await waitFor(() =>
      expect(renderedTitles()).toEqual(["Maré de Setembro", "Estrada de Terra", "Coração de Vento"]),
    );
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Mover Estrada de Terra para baixo",
    );
  });
});

describe("exclusão de repertório", () => {
  it("exige confirmação e não apaga as músicas", async () => {
    await openEnsaio();
    const songsBefore = fakeAccount.library().songs.length;

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    expect(storedRepertoires().some((r) => r.id === ENSAIO)).toBe(true);

    fireEvent.click(dialog.getByRole("button", { name: "Excluir repertório" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/repertorios"));
    expect(lastToast()).toBe("Repertório excluído.");
    const stored = fakeAccount.library();
    expect(stored.repertoires.some((r: { id: string }) => r.id === ENSAIO)).toBe(false);
    expect(stored.songs).toHaveLength(songsBefore);
  });
});
