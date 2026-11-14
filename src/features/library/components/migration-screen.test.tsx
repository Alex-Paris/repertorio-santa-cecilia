import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import { demoSongs } from "@/features/songs/data/demo-songs";
import { toastStore } from "@/lib/utils/toast";
import { apiError } from "@/test/fake-library-server";

import { accountLibrary } from "../data/browser-library";
import { LIBRARY_STORAGE_KEY } from "../data/library-storage";
import { readBrowserLegacyLibrary } from "../legacy/legacy-library";
import { MigrationScreen } from "./migration-screen";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/auth/auth-client", () => ({
  authClient: {
    getSession: vi.fn(async () => ({ data: { user: { id: "user-a" } }, error: null })),
  },
}));

const USER = "user-a";
const LEGACY = JSON.stringify({ schemaVersion: 1, songs: demoSongs, repertoires: demoRepertoires });
const ATTEMPT_KEY = `repertorio.migration.v1.${USER}`;
const IMPORT_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

type Handler = (body: unknown) => Response | Promise<Response>;

let remoteCounts: { songs: number; repertoires: number };
let handlers: Partial<Record<"preview" | "import" | "status", Handler>>;
let calls: { path: string; method: string; body: unknown; attemptAtSend: string | null }[];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function importResult() {
  return {
    import: {
      importId: IMPORT_ID,
      status: "completed",
      replayed: false,
      songs: demoSongs.length,
      repertoires: demoRepertoires.length,
    },
  };
}

function previewResult() {
  const isEmpty = remoteCounts.songs === 0 && remoteCounts.repertoires === 0;
  return {
    preview: {
      summary: { songs: demoSongs.length, repertoires: demoRepertoires.length, items: 0 },
      remote: { ...remoteCounts, isEmpty },
      canImport: isEmpty,
      conflicts: isEmpty ? [] : ["remote_library_not_empty"],
    },
  };
}

function call(path: string) {
  return calls.filter((entry) => entry.path === path);
}

function importCalls() {
  return call("/import");
}

async function openScreen(): Promise<void> {
  render(<MigrationScreen userId={USER} />);
  await waitFor(() => expect(screen.queryByText("Copiar minha biblioteca")).toBeNull());
}

async function ready(): Promise<void> {
  await openScreen();
  await screen.findByRole("button", { name: "Copiar para minha conta" });
}

async function confirmCopy(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: "Copiar para minha conta" }));
  const dialog = within(await screen.findByRole("alertdialog"));
  fireEvent.click(dialog.getByRole("button", { name: "Confirmar cópia" }));
}

function savedAttempt(): { importId: string; status: string } {
  return JSON.parse(localStorage.getItem(ATTEMPT_KEY) ?? "null") as { importId: string; status: string };
}

/** Grava uma tentativa pendente com a impressão digital do conteúdo atual. */
async function seedPendingAttempt(): Promise<void> {
  const { fingerprintLibrary } = await import("../migration/migration-attempts");
  const legacy = readBrowserLegacyLibrary();
  if (legacy.status !== "ready") {
    throw new Error("biblioteca antiga indisponível");
  }
  localStorage.setItem(
    ATTEMPT_KEY,
    JSON.stringify({
      userId: USER,
      importId: IMPORT_ID,
      fingerprint: fingerprintLibrary(legacy.library),
      status: "pending",
      startedAt: "2026-11-08T12:00:00.000Z",
    }),
  );
}

beforeEach(() => {
  accountLibrary.prepareSignOut();
  localStorage.clear();
  localStorage.setItem(LIBRARY_STORAGE_KEY, LEGACY);
  push.mockClear();
  remoteCounts = { songs: 0, repertoires: 0 };
  handlers = {};
  calls = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit) => {
      const path = input.replace("/api/v1/library", "");
      const body = init.body ? (JSON.parse(String(init.body)) as unknown) : undefined;
      calls.push({ path, method: init.method ?? "GET", body, attemptAtSend: localStorage.getItem(ATTEMPT_KEY) });

      if (path === "/import/preview") {
        return handlers.preview?.(body) ?? json(previewResult());
      }
      if (path === "/import") {
        return handlers.import?.(body) ?? json(importResult(), 201);
      }
      if (path.startsWith("/imports/")) {
        return handlers.status?.(body) ?? json({ import: { status: "unknown", importId: IMPORT_ID, message: "x" } });
      }
      if (path === "/songs") {
        return json({ songs: demoSongs.map((song) => ({ ...song, revision: 1 })) });
      }
      if (path === "/repertoires") {
        return json({ repertoires: demoRepertoires.map((entry) => ({ ...entry, revision: 1 })) });
      }
      return apiError(404, "not_found");
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("prévia da migração", () => {
  it("mostra as duas bibliotecas e o aviso de cópia", async () => {
    await ready();

    expect(screen.getByRole("heading", { name: "Biblioteca antiga" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Sua conta" })).toBeDefined();
    expect(screen.getByText("0 músicas")).toBeDefined();
    expect(screen.getByText(/não será apagada nem sincronizada/)).toBeDefined();
  });

  it("a prévia não executa nenhuma importação nem cria tentativa", async () => {
    await ready();

    expect(call("/import/preview")).toHaveLength(1);
    expect(importCalls()).toHaveLength(0);
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
  });

  it("oferece o backup local antes de copiar", async () => {
    const createObjectURL = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    await ready();

    fireEvent.click(screen.getAllByRole("button", { name: "Baixar backup local" })[0]);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(importCalls()).toHaveLength(0);
  });

  it("mostra o conflito e não oferece cópia para uma conta preenchida", async () => {
    remoteCounts = { songs: 3, repertoires: 1 };
    await openScreen();

    expect(await screen.findByText(/ainda não é suportada/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Copiar para minha conta" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Baixar backup local" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Abrir minha biblioteca" }).getAttribute("href")).toBe("/biblioteca");
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBe(LEGACY);
  });

  it("orienta a recuperação quando os dados locais estão danificados", async () => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, "{corrompido");
    await openScreen();

    expect(await screen.findByText(/está danificada/)).toBeDefined();
    expect(calls).toHaveLength(0);
  });

  it("recusa localmente uma biblioteca acima dos limites", async () => {
    const songs = Array.from({ length: 5001 }, (_, index) => ({
      ...demoSongs[0],
      id: `s-${index}`,
    }));
    localStorage.setItem(
      LIBRARY_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, songs, repertoires: [] }),
    );
    await openScreen();

    expect(await screen.findByText(/excede os limites/)).toBeDefined();
    expect(calls).toHaveLength(0);
  });
});

describe("confirmação", () => {
  it("nada é enviado se a pessoa cancelar", async () => {
    await ready();

    fireEvent.click(screen.getByRole("button", { name: "Copiar para minha conta" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    expect(dialog.getByText(/não cria sincronização/)).toBeDefined();
    fireEvent.click(dialog.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(importCalls()).toHaveLength(0);
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
  });

  it("persiste o importId antes do primeiro envio e usa o mesmo no pedido", async () => {
    await ready();
    await confirmCopy();
    await screen.findByText(/Cópia concluída/);

    const [sent] = importCalls();
    const persisted = JSON.parse(sent.attemptAtSend ?? "null") as { importId: string; status: string };
    expect(persisted.status).toBe("pending");
    expect((sent.body as { importId: string }).importId).toBe(persisted.importId);
  });

  it("não inicia a importação se não puder registrar a tentativa", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Copiar para minha conta" }));
    const dialog = within(await screen.findByRole("alertdialog"));

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("cheio", "QuotaExceededError");
    });
    fireEvent.click(dialog.getByRole("button", { name: "Confirmar cópia" }));

    await waitFor(() => expect(screen.queryByText(/Tentar novamente/)).not.toBeNull());
    expect(importCalls()).toHaveLength(0);
  });

  it("não apaga os dados locais ao concluir", async () => {
    await ready();
    const before = localStorage.getItem(LIBRARY_STORAGE_KEY);

    await confirmCopy();
    await screen.findByText(/Cópia concluída/);

    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBe(before);
    expect(screen.getByText(/continuam intactos/)).toBeDefined();
  });

  it("depois de concluir, oferece abrir a biblioteca", async () => {
    await ready();
    await confirmCopy();
    await screen.findByText(/Cópia concluída/);

    expect(screen.getByRole("link", { name: "Abrir minha biblioteca" }).getAttribute("href")).toBe("/biblioteca");
    expect(push).not.toHaveBeenCalled();
  });

  it("um 409 depois de uma prévia limpa é respeitado", async () => {
    await ready();
    handlers.import = () => {
      remoteCounts = { songs: 2, repertoires: 0 };
      return apiError(409, "remote_library_not_empty", "Conta com dados.", "remote-library-not-empty");
    };

    await confirmCopy();

    expect(await screen.findByText(/ainda não é suportada/)).toBeDefined();
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
  });

  it("mantém a tentativa quando a sessão expira", async () => {
    await ready();
    handlers.import = () => apiError(401, "unauthenticated");

    await confirmCopy();

    expect(await screen.findByText("Sua sessão expirou")).toBeDefined();
    expect(savedAttempt().status).toBe("pending");
  });
});

describe("resultado incerto", () => {
  function networkFailure(): never {
    throw new TypeError("failed to fetch");
  }

  it("na falha de rede, consulta o status e confirma o sucesso", async () => {
    await ready();
    handlers.import = networkFailure;
    handlers.status = () => json(importResult());

    await confirmCopy();

    expect(await screen.findByText(/Cópia concluída/)).toBeDefined();
    expect(importCalls()).toHaveLength(1);
  });

  it("um 503 não é tratado como rollback", async () => {
    await ready();
    handlers.import = () => apiError(503, "persistence_failed");
    handlers.status = () => json(importResult());

    await confirmCopy();

    expect(await screen.findByText(/Cópia concluída/)).toBeDefined();
  });

  it("status desconhecido informa a incerteza, sem nova tentativa automática", async () => {
    await ready();
    handlers.import = () => apiError(503, "persistence_failed");

    await confirmCopy();

    expect(await screen.findByText("Resultado ainda não confirmado")).toBeDefined();
    expect(screen.queryByText(/Cópia concluída/)).toBeNull();
    expect(importCalls()).toHaveLength(1);
    expect(savedAttempt().status).toBe("pending");
  });

  it("repete com o mesmo importId e o mesmo conteúdo", async () => {
    await ready();
    handlers.import = networkFailure;
    await confirmCopy();
    await screen.findByText("Resultado ainda não confirmado");

    handlers.import = undefined;
    fireEvent.click(screen.getByRole("button", { name: "Repetir com o mesmo conteúdo" }));
    await screen.findByText(/Cópia concluída/);

    const [first, second] = importCalls() as { body: { importId: string; backup: { songs: unknown } } }[];
    expect(second.body.importId).toBe(first.body.importId);
    expect(second.body.backup.songs).toEqual(first.body.backup.songs);
  });

  it("verifica de novo quando a pessoa pede", async () => {
    await ready();
    handlers.import = networkFailure;
    await confirmCopy();
    await screen.findByText("Resultado ainda não confirmado");

    handlers.status = () => json(importResult());
    fireEvent.click(screen.getByRole("button", { name: "Verificar novamente" }));

    expect(await screen.findByText(/Cópia concluída/)).toBeDefined();
  });

  it("recupera a tentativa pendente depois de recarregar", async () => {
    await seedPendingAttempt();
    handlers.status = () => json(importResult());

    await openScreen();

    expect(await screen.findByText(/Cópia concluída/)).toBeDefined();
    expect(call(`/imports/${IMPORT_ID}`)).toHaveLength(1);
    expect(call("/import/preview")).toHaveLength(0);
  });

  it("não reutiliza o importId se os dados locais mudaram", async () => {
    await seedPendingAttempt();
    const changed = { schemaVersion: 1, songs: [{ ...demoSongs[0], title: "Editada depois" }], repertoires: [] };
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(changed));

    await openScreen();

    await screen.findByText("Resultado ainda não confirmado");
    expect(screen.queryByRole("button", { name: "Repetir com o mesmo conteúdo" })).toBeNull();
    expect(screen.getByText(/mudou depois desta tentativa/)).toBeDefined();
  });

  it("sem consulta possível, não oferece descartar a tentativa", async () => {
    await seedPendingAttempt();
    handlers.status = () => apiError(503, "persistence_failed");

    await openScreen();

    await screen.findByText(/Não foi possível consultar o servidor/);
    expect(screen.queryByRole("button", { name: "Descartar esta tentativa" })).toBeNull();
  });

  it("informa quando a cópia terminou, mas a conta não pôde ser lida", async () => {
    const fetchMock = vi.mocked(fetch);
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith("/songs")) {
        return apiError(503, "persistence_failed");
      }
      return original(input, init);
    });

    await ready();
    await confirmCopy();

    expect(await screen.findByText(/Cópia concluída/)).toBeDefined();
    expect(screen.getByText(/Não faça uma nova cópia/)).toBeDefined();
  });
});

describe("recuperação de dados antigos", () => {
  it("informa quando não há nada a importar, sem criar dados", async () => {
    localStorage.removeItem(LIBRARY_STORAGE_KEY);

    await openScreen();

    expect(await screen.findByText("Nada para importar")).toBeDefined();
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("identifica uma biblioteca só com exemplos, sem impedir a escolha", async () => {
    await ready();

    expect(screen.getByText(/apenas os exemplos/)).toBeDefined();
  });

  it("permite baixar os dados originais quando estão danificados, sem alterá-los", async () => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, "{corrompido");
    const createObjectURL = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    await openScreen();

    fireEvent.click((await screen.findAllByRole("button", { name: "Baixar dados originais" }))[0]);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBe("{corrompido");
  });

  it("aceita um arquivo de backup como origem da cópia", async () => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, "{corrompido");
    await openScreen();
    await screen.findByText(/está danificada/);

    fireEvent.change(screen.getByLabelText("Arquivo de backup"), {
      target: { files: [new File([LEGACY], "backup.json")] },
    });

    expect(await screen.findByRole("heading", { name: "Arquivo de backup" })).toBeDefined();
    expect(call("/import/preview")).toHaveLength(1);
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBe("{corrompido");
  });

  it("recusa um arquivo inválido e explica o motivo", async () => {
    await ready();

    fireEvent.change(screen.getByLabelText("Arquivo de backup"), {
      target: { files: [new File(["não é json"], "backup.json")] },
    });

    expect(await screen.findByText(/JSON válido/)).toBeDefined();
    expect(importCalls()).toHaveLength(0);
  });
});

describe("apagar a biblioteca antiga", () => {
  async function openDeletion(): Promise<HTMLElement> {
    await openScreen();
    return (await screen.findByRole("heading", { name: "Apagar biblioteca antiga deste navegador" })).closest(
      "section",
    ) as HTMLElement;
  }

  function seedOtherKeys(): void {
    localStorage.setItem("repertorio.reader.preferences.v1", JSON.stringify({ fontSize: 22 }));
    localStorage.setItem("repertorio-theme", "dark");
    localStorage.setItem("outro-aplicativo", "manter");
    localStorage.setItem(ATTEMPT_KEY, JSON.stringify({ qualquer: true }));
  }

  it("mostra quantidades, avisos e distingue de excluir a conta", async () => {
    const section = within(await openDeletion());

    expect(section.getByText(/\d+ músicas e \d+ repertórios/)).toBeDefined();
    expect(section.getByText(/podem não estar na sua conta/)).toBeDefined();
    fireEvent.click(section.getByRole("button", { name: "Apagar deste navegador" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    expect(dialog.getByText(/não pode ser desfeita/)).toBeDefined();
    expect(dialog.getByText(/não exclui sua conta/)).toBeDefined();
  });

  it("permite baixar o backup antes", async () => {
    const createObjectURL = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const section = within(await openDeletion());

    fireEvent.click(section.getByRole("button", { name: "Baixar backup local" }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBe(LEGACY);
  });

  it("cancelar preserva tudo", async () => {
    const section = within(await openDeletion());

    fireEvent.click(section.getByRole("button", { name: "Apagar deste navegador" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBe(LEGACY);
  });

  it("apaga somente a chave antiga, sem tocar na conta nem em outros dados", async () => {
    seedOtherKeys();
    const others = Object.fromEntries(
      Object.keys(localStorage)
        .filter((key) => key !== LIBRARY_STORAGE_KEY)
        .map((key) => [key, localStorage.getItem(key)]),
    );
    const section = within(await openDeletion());
    const requestsBefore = calls.length;

    fireEvent.click(section.getByRole("button", { name: "Apagar deste navegador" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    await act(async () => {
      fireEvent.click(dialog.getByRole("button", { name: "Apagar deste navegador" }));
    });

    await waitFor(() => expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBeNull());
    for (const [key, value] of Object.entries(others)) {
      expect(localStorage.getItem(key)).toBe(value);
    }
    expect(calls.slice(requestsBefore).every((entry) => entry.method === "GET" || entry.path === "/import/preview")).toBe(true);
    expect(await screen.findByText("Nada para importar")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Apagar biblioteca antiga deste navegador" })).toBeNull();
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBeNull();
  });

  it("preserva dados danificados até a confirmação, e então os apaga", async () => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, "{corrompido");
    const section = within(await openDeletion());

    expect(section.getByText(/dados danificados/)).toBeDefined();
    expect(section.getByRole("button", { name: "Baixar dados originais" })).toBeDefined();
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBe("{corrompido");

    fireEvent.click(section.getByRole("button", { name: "Apagar deste navegador" }));
    await act(async () => {
      fireEvent.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Apagar deste navegador" }),
      );
    });

    await waitFor(() => expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBeNull());
  });

  it("informa a falha e não afirma sucesso", async () => {
    const section = within(await openDeletion());
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    const toastsBefore = toastStore.getSnapshot().length;

    fireEvent.click(section.getByRole("button", { name: "Apagar deste navegador" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    await act(async () => {
      fireEvent.click(dialog.getByRole("button", { name: "Apagar deste navegador" }));
    });

    expect(await dialog.findByText(/Não foi possível apagar a biblioteca antiga/)).toBeDefined();
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toBe(LEGACY);
    expect(toastStore.getSnapshot().slice(toastsBefore).map((toast) => toast.message)).not.toContain(
      "Biblioteca antiga apagada deste navegador.",
    );
  });

  it("acompanha a exclusão feita em outra aba", async () => {
    await openDeletion();

    localStorage.removeItem(LIBRARY_STORAGE_KEY);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: LIBRARY_STORAGE_KEY, oldValue: LEGACY, newValue: null }));
    });

    expect(await screen.findByText("Nada para importar")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Apagar biblioteca antiga deste navegador" })).toBeNull();
  });
});
