import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RepertoireFormScreen } from "@/features/repertoires/components/repertoire-form-screen";
import { SongFormScreen } from "@/features/songs/components/song-form-screen";
import { demoSongs } from "@/features/songs/data/demo-songs";
import { apiError } from "@/test/fake-library-server";

import { accountLibrary } from "../data/browser-library";

const auth = vi.hoisted(() => ({ getSession: vi.fn(), signIn: { email: vi.fn() } }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => ({ authClient: auth }));

const SONG = "s-existente";

let respond: (path: string, init: RequestInit) => Response;
let requests: { path: string; method: string; expectedUser: string | null }[];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function account(path: string): Response {
  return path === "/songs"
    ? json({ songs: [{ ...demoSongs[0], id: SONG, title: "Na Conta", revision: 1 }] })
    : json({ repertoires: [] });
}

function session(id: string | null): void {
  auth.getSession.mockResolvedValue({
    data: id ? { user: { id, email: `${id}@exemplo.test` } } : null,
    error: null,
  });
}

function posts(): typeof requests {
  return requests.filter((request) => request.method !== "GET");
}

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label);
}

function type(label: string, value: string): void {
  fireEvent.change(field(label), { target: { value } });
}

async function enterAccount(): Promise<void> {
  await accountLibrary.checkSession();
  await waitFor(() => expect(accountLibrary.getSnapshot().status).toBe("ready"));
}

async function openNewSong(): Promise<void> {
  await enterAccount();
  render(<SongFormScreen />);
  await screen.findByRole("heading", { level: 1, name: "Nova música" });
}

async function typeDraft(): Promise<void> {
  type("Título", "Rascunho Longo");
  type("Artista", "Pessoa");
  type("Cifra (ChordPro)", "[G]Horas de trabalho");
  await act(async () => undefined);
}

async function save(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Salvar música" }));
  });
}

beforeEach(() => {
  accountLibrary.prepareSignOut();
  localStorage.clear();
  auth.getSession.mockReset();
  auth.signIn.email.mockReset();
  session("user-a");
  router.push.mockClear();
  respond = account;
  requests = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit) => {
      const path = input.replace("/api/v1/library", "");
      requests.push({
        path,
        method: init.method ?? "GET",
        expectedUser: new Headers(init.headers).get("x-repertorio-expected-user"),
      });
      return respond(path, init);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sessão expirada com rascunho", () => {
  beforeEach(async () => {
    await openNewSong();
    await typeDraft();
    respond = () => apiError(401, "unauthenticated");
    await save();
  });

  it("mantém o texto e avisa, sem trocar a tela", async () => {
    expect(await screen.findByText(/Sua sessão expirou. Nada foi salvo/)).toBeDefined();
    expect(field("Título").value).toBe("Rascunho Longo");
    expect(field("Cifra (ChordPro)").value).toContain("Horas de trabalho");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("não promete guardar o rascunho depois de fechar a aba", async () => {
    expect(await screen.findByText(/Se você fechar ou atualizar a aba, ele será perdido/)).toBeDefined();
  });

  it("não grava o rascunho no navegador", () => {
    expect(JSON.stringify({ ...localStorage })).not.toContain("Rascunho Longo");
  });

  it("bloqueia novas tentativas de salvar sem sessão", async () => {
    const before = posts().length;

    await save();

    expect(posts()).toHaveLength(before);
    expect(field("Título").value).toBe("Rascunho Longo");
  });

  it("pede a senha da mesma conta, sem permitir trocar o e-mail", async () => {
    await screen.findByText(/Sua sessão expirou. Nada foi salvo/);

    expect(field("E-mail").readOnly).toBe(true);
    expect(field("E-mail").value).toBe("user-a@exemplo.test");
  });

  it("depois de entrar de novo, salva o rascunho na mesma conta", async () => {
    await screen.findByText(/Sua sessão expirou. Nada foi salvo/);
    auth.signIn.email.mockResolvedValue({ error: null });
    respond = (path, init) =>
      init.method === "POST"
        ? json({ song: { ...demoSongs[0], id: "s-nova", title: "Rascunho Longo", revision: 1 } }, 201)
        : account(path);

    type("Senha", "senha-da-conta");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Entrar novamente" }));
    });

    await waitFor(() => expect(screen.queryByText(/Sua sessão expirou. Nada foi salvo/)).toBeNull());
    expect(field("Título").value).toBe("Rascunho Longo");

    await save();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/musicas/s-nova"));
    expect(posts().at(-1)?.expectedUser).toBe("user-a");
  });

  it("mostra o erro de senha e mantém o texto", async () => {
    await screen.findByText(/Sua sessão expirou. Nada foi salvo/);
    auth.signIn.email.mockResolvedValue({ error: { code: "INVALID_EMAIL_OR_PASSWORD" } });

    type("Senha", "errada");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Entrar novamente" }));
    });

    expect(await screen.findByText(/E-mail ou senha incorretos/)).toBeDefined();
    expect(field("Título").value).toBe("Rascunho Longo");
  });

  it("com outra conta, descarta o rascunho e nada é salvo nela", async () => {
    await screen.findByText(/Sua sessão expirou. Nada foi salvo/);
    const before = posts().length;

    session("user-b");
    await act(async () => {
      await accountLibrary.checkSession();
    });

    await waitFor(() => expect(screen.queryByDisplayValue("Rascunho Longo")).toBeNull());
    expect(accountLibrary.getRemoteUserId()).toBe("user-b");
    expect(posts()).toHaveLength(before);
  });
});

describe("troca de identidade durante a edição", () => {
  it("a recusa do servidor impede salvar na conta errada e tira o rascunho da tela", async () => {
    await openNewSong();
    await typeDraft();
    respond = (path, init) =>
      new Headers(init.headers).get("x-repertorio-expected-user") === "user-a"
        ? apiError(409, "session_changed")
        : account(path);
    session("user-b");

    await save();

    await waitFor(() => expect(accountLibrary.getRemoteUserId()).toBe("user-b"));
    await waitFor(() => expect(screen.queryByDisplayValue("Rascunho Longo")).toBeNull());
    expect(posts().at(-1)?.expectedUser).toBe("user-a");
  });
});

describe("sem rascunho", () => {
  it("segue o fluxo normal de sessão expirada", async () => {
    await openNewSong();
    respond = () => apiError(401, "unauthenticated");

    await act(async () => {
      await accountLibrary.retry();
    });

    expect(await screen.findByRole("link", { name: "Entrar" })).toBeDefined();
    expect(screen.queryByLabelText("Título")).toBeNull();
  });
});

describe("falha temporária", () => {
  it("não mostra aviso de sessão e mantém o texto", async () => {
    await openNewSong();
    await typeDraft();
    respond = () => apiError(503, "persistence_failed");

    await save();

    expect(await screen.findByText(/Não foi possível confirmar/)).toBeDefined();
    expect(screen.queryByText(/Sua sessão expirou/)).toBeNull();
    expect(field("Título").value).toBe("Rascunho Longo");
  });
});

describe("saída explícita da conta", () => {
  it("o logout não mantém o rascunho na tela", async () => {
    await openNewSong();
    await typeDraft();

    act(() => accountLibrary.prepareSignOut());

    await waitFor(() => expect(screen.queryByDisplayValue("Rascunho Longo")).toBeNull());
  });
});

describe("outros formulários", () => {
  it("o formulário de repertório também mantém o texto", async () => {
    await enterAccount();
    render(<RepertoireFormScreen />);
    await screen.findByRole("heading", { level: 1, name: "Novo repertório" });

    type("Nome", "Show de Sábado");
    await act(async () => undefined);
    respond = () => apiError(401, "unauthenticated");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    });

    expect(await screen.findByText(/Sua sessão expirou. Nada foi salvo/)).toBeDefined();
    expect(field("Nome").value).toBe("Show de Sábado");
  });
});
