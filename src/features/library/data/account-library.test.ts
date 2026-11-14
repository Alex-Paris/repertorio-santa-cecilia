import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { demoSongs } from "@/features/songs/data/demo-songs";
import type { SongInput } from "@/features/songs/domain/song";
import { apiError, createFakeLibraryServer, type FakeLibraryServer } from "@/test/fake-library-server";

import { createAccountLibrary, type AccountLibrary, type AccountLibrarySnapshot, type SessionCheck } from "./account-library";
import { LIBRARY_STORAGE_KEY } from "./library-storage";
import { createRemoteLibrary } from "./remote/remote-library";

const input: SongInput = {
  title: "Nova",
  artist: "Artista",
  originalKey: "G",
  contentType: "original",
  chordPro: "[G]Letra",
};

const signedIn = (userId: string): SessionCheck => ({ status: "authenticated", userId });

let server: FakeLibraryServer;
let session: SessionCheck;
let notify: ReturnType<typeof vi.fn<(message: string) => void>>;
let library: AccountLibrary;
let stop: () => void;

function start(): void {
  library = createAccountLibrary({
    getSession: async () => session,
    createRemote: (userId, callbacks) =>
      createRemoteLibrary({ userId, fetchImpl: server.fetchFor(userId), ...callbacks }),
    notify,
  });
  stop = library.subscribe(() => undefined);
}

async function settle(): Promise<void> {
  for (let index = 0; index < 8; index++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function titles(snapshot: AccountLibrarySnapshot): string[] {
  return snapshot.status === "ready" ? snapshot.library.songs.map((song) => song.title) : [];
}

async function startSettled(): Promise<void> {
  start();
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  server = createFakeLibraryServer();
  session = { status: "anonymous" };
  notify = vi.fn();
});

afterEach(() => stop?.());

describe("sem sessão", () => {
  it("não carrega nada nem chama a API privada", async () => {
    await startSettled();

    expect(library.getSnapshot()).toEqual({ status: "signed-out" });
    expect(server.requests).toHaveLength(0);
  });

  it("não permite CRUD", async () => {
    await startSettled();

    expect(() => library.songs.create(input)).toThrow(expect.objectContaining({ code: "session-expired" }));
    expect(() => library.repertoires.list()).toThrow(expect.objectContaining({ code: "session-expired" }));
    expect(server.requests).toHaveLength(0);
  });

  it("não aceita escrita enquanto a sessão não foi conferida", () => {
    start();

    expect(library.getSnapshot()).toEqual({ status: "loading" });
    expect(() => library.songs.create(input)).toThrow(expect.objectContaining({ code: "remote-unavailable" }));
  });

  it("não cria exemplos nem lê a biblioteca antiga", async () => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, songs: [], repertoires: [] }));
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    await startSettled();

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("com sessão", () => {
  beforeEach(() => {
    session = signedIn("a");
  });

  it("carrega a biblioteca da conta", async () => {
    server.account("a").songs.push({ ...demoSongs[1], title: "Da conta" });

    await startSettled();

    expect(titles(library.getSnapshot())).toEqual(["Da conta"]);
  });

  it("uma conta nova continua vazia, sem dados de exemplo", async () => {
    await startSettled();

    const snapshot = library.getSnapshot();
    expect(snapshot.status).toBe("ready");
    expect(titles(snapshot)).toEqual([]);
  });

  it("o login carrega a conta, sem precisar recarregar a página", async () => {
    session = { status: "anonymous" };
    await startSettled();

    session = signedIn("a");
    await library.checkSession();
    await settle();

    expect(library.getSnapshot().status).toBe("ready");
    expect(library.getRemoteUserId()).toBe("a");
  });

  it("existe uma única fonte de escrita: a API", async () => {
    await startSettled();
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    await library.songs.create(input);

    expect(server.requests).toContainEqual({ userId: "a", method: "POST", path: "/songs" });
    expect(setItem).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("guardar os dados da conta nunca passa pelo navegador", async () => {
    server.account("a").songs.push({ ...demoSongs[1], title: "Privada" });

    await startSettled();

    expect(JSON.stringify({ ...localStorage })).not.toContain("Privada");
  });
});

describe("biblioteca antiga", () => {
  const legacy = JSON.stringify({ schemaVersion: 1, songs: [demoSongs[0]], repertoires: [] });

  beforeEach(() => localStorage.setItem(LIBRARY_STORAGE_KEY, legacy));

  it("o login não importa nem altera", async () => {
    session = signedIn("a");

    await startSettled();

    expect(titles(library.getSnapshot())).toEqual([]);
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBe(legacy);
    expect(server.requests.every((request) => request.method === "GET")).toBe(true);
  });

  it("o logout não apaga", async () => {
    session = signedIn("a");
    await startSettled();

    library.prepareSignOut();

    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBe(legacy);
  });

  it("a troca de conta não apaga", async () => {
    session = signedIn("a");
    await startSettled();

    session = signedIn("b");
    await library.checkSession();
    await settle();

    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBe(legacy);
  });

  it("uma falha remota não ativa a biblioteca antiga", async () => {
    session = signedIn("a");
    server.fail(() => apiError(503, "persistence_failed"));

    await startSettled();

    expect(library.getSnapshot()).toEqual({ status: "remote-error", reason: "unavailable" });
  });
});

describe("indisponibilidade", () => {
  it("sem confirmar a identidade, mostra erro e permite tentar de novo", async () => {
    session = { status: "unavailable" };
    await startSettled();

    expect(library.getSnapshot()).toEqual({ status: "remote-error", reason: "unavailable" });

    session = signedIn("a");
    await library.retry();
    await settle();

    expect(library.getSnapshot().status).toBe("ready");
  });

  it("um erro de leitura não vira lista vazia", async () => {
    session = signedIn("a");
    server.fail(() => apiError(503, "persistence_failed"));
    await startSettled();

    expect(library.getSnapshot()).toEqual({ status: "remote-error", reason: "unavailable" });

    server.restore();
    await library.retry();
    await settle();

    expect(library.getSnapshot().status).toBe("ready");
  });

  it("mantém os dados confirmados e avisa quando a atualização falha", async () => {
    session = signedIn("a");
    server.account("a").songs.push({ ...demoSongs[1], title: "Confirmada" });
    await startSettled();

    server.fail(() => apiError(503, "persistence_failed"));
    await library.retry();
    await settle();

    const snapshot = library.getSnapshot();
    expect(titles(snapshot)).toEqual(["Confirmada"]);
    expect(snapshot).toMatchObject({ stale: true });
  });

  it("rejeita dados fora do contrato", async () => {
    session = signedIn("a");
    server.fail(() => new Response(JSON.stringify({ songs: [{ id: 1 }], repertoires: [] })));
    await startSettled();

    expect(library.getSnapshot()).toEqual({ status: "remote-error", reason: "invalid-response" });
  });
});

describe("isolamento entre sessões", () => {
  beforeEach(() => {
    session = signedIn("a");
    server.account("a").songs.push({ ...demoSongs[1], title: "Da conta A" });
    server.account("b").songs.push({ ...demoSongs[2], title: "Da conta B" });
  });

  it("o logout descarta os dados e mostra o estado sem sessão", async () => {
    await startSettled();

    library.prepareSignOut();

    expect(library.getSnapshot()).toEqual({ status: "signed-out" });
    expect(library.getRemoteUserId()).toBeNull();
  });

  it("uma leitura em andamento não reaparece depois do logout", async () => {
    const release = server.hold();
    start();
    await settle();

    library.prepareSignOut();
    release();
    await settle();

    expect(library.getSnapshot()).toEqual({ status: "signed-out" });
  });

  it("uma resposta antiga da conta A não alcança a conta B", async () => {
    const releaseA = server.hold();
    start();
    await settle();

    library.prepareSignOut();
    session = signedIn("b");
    releaseA();
    await library.checkSession();
    await settle();

    expect(titles(library.getSnapshot())).toEqual(["Da conta B"]);
  });

  it("ao perceber outra conta, troca os dados e avisa", async () => {
    await startSettled();

    session = signedIn("b");
    await library.checkSession();
    await settle();

    expect(titles(library.getSnapshot())).toEqual(["Da conta B"]);
    expect(notify).toHaveBeenCalledOnce();
  });

  it("não mistura dados enquanto a nova conta carrega", async () => {
    await startSettled();
    const release = server.hold();

    session = signedIn("b");
    await library.checkSession();

    expect(library.getSnapshot()).toEqual({ status: "loading" });
    release();
    await settle();
  });

  it("se o servidor informar que a conta mudou, recarrega a conta certa", async () => {
    await startSettled();

    session = signedIn("b");
    server.fail(() => apiError(409, "session_changed"));
    await expect(library.songs.create(input)).rejects.toMatchObject({ code: "session-changed" });
    server.restore();
    await settle();

    expect(library.getRemoteUserId()).toBe("b");
    expect(titles(library.getSnapshot())).toEqual(["Da conta B"]);
  });

  it("não repete sem fim quando sessão e API discordam", async () => {
    await startSettled();
    const before = server.requests.length;

    server.fail(() => apiError(409, "session_changed"));
    await library.retry();
    await settle();

    expect(library.getSnapshot()).toEqual({ status: "remote-error", reason: "unavailable" });
    expect(server.requests.length - before).toBeLessThan(8);
  });

  it("a sessão expirada descarta os dados e bloqueia escritas", async () => {
    await startSettled();

    server.fail(() => apiError(401, "unauthenticated"));
    await library.retry();
    await settle();

    expect(library.getSnapshot()).toEqual({ status: "remote-error", reason: "session-expired" });

    const before = server.requests.length;
    await expect(library.songs.create(input)).rejects.toMatchObject({ code: "session-expired" });
    expect(server.requests).toHaveLength(before);
  });

  it("uma sessão encerrada em outra aba bloqueia a escrita", async () => {
    await startSettled();

    session = { status: "anonymous" };
    await library.checkSession();

    expect(library.getSnapshot()).toEqual({ status: "remote-error", reason: "session-expired" });
    await expect(library.songs.create(input)).rejects.toMatchObject({ code: "session-expired" });
  });

  it("recupera a biblioteca ao entrar de novo com a mesma conta", async () => {
    await startSettled();
    session = { status: "anonymous" };
    await library.checkSession();

    session = signedIn("a");
    await library.checkSession();
    await settle();

    expect(titles(library.getSnapshot())).toEqual(["Da conta A"]);
  });
});

describe("leitura e escrita", () => {
  beforeEach(() => {
    session = signedIn("a");
  });

  it("mostra carregamento até a resposta", async () => {
    const release = server.hold();
    start();
    await settle();

    expect(library.getSnapshot().status).toBe("loading");

    release();
    await settle();
    expect(library.getSnapshot().status).toBe("ready");
  });

  it("atualiza a tela só depois da confirmação da API", async () => {
    await startSettled();
    const release = server.hold();

    const creating = library.songs.create(input);
    await settle();
    expect(titles(library.getSnapshot())).toEqual([]);

    release();
    await creating;
    await settle();
    expect(titles(library.getSnapshot())).toEqual(["Nova"]);
  });

  it("não afirma falha definitiva quando não há resposta do servidor", async () => {
    await startSettled();

    server.fail(() => {
      throw new TypeError("failed to fetch");
    });

    await expect(library.songs.create(input)).rejects.toMatchObject({ code: "write-uncertain" });
  });

  it("revalida ao voltar para a aba", async () => {
    server.account("a").songs.push({ ...demoSongs[1], title: "Antiga" });
    await startSettled();
    server.account("a").songs[0].title = "Editada em outro aparelho";

    window.dispatchEvent(new Event("focus"));
    await settle();

    expect(titles(library.getSnapshot())).toEqual(["Editada em outro aparelho"]);
  });

  it("a atualização explícita busca os dados de novo", async () => {
    await startSettled();
    server.account("a").songs.push({ ...demoSongs[1], title: "Chegou depois" });

    await library.retry();
    await settle();

    expect(titles(library.getSnapshot())).toEqual(["Chegou depois"]);
  });

  it("congela os dados entregues às telas", async () => {
    server.account("a").songs.push({ ...demoSongs[1] });
    await startSettled();

    const snapshot = library.getSnapshot();
    if (snapshot.status !== "ready") {
      throw new Error("deveria estar pronto");
    }
    expect(Object.isFrozen(snapshot.library.songs[0])).toBe(true);
  });
});
