import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { accountLibrary } from "@/features/library/data/browser-library";
import { apiError } from "@/test/fake-library-server";

import { RIGHTS_DECLARATION_VERSION, type ShareSummary } from "../domain/public-share";
import { ShareRepertoireScreen } from "./share-repertoire-screen";

const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => ({ authClient: auth }));

const dates = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z", revision: 1 };
const HASH = "a".repeat(64);

const songs = [
  { ...dates, id: "s1", title: "Com Cifra", artist: "A", originalKey: "G", contentType: "original", chordPro: "[G]Letra" },
  { ...dates, id: "s2", title: "Autorizada", artist: "B", originalKey: "C", contentType: "authorized", chordPro: "[C]Outra" },
  { ...dates, id: "s3", title: "Externa", artist: "C", originalKey: "D", contentType: "external-link", sourceUrl: "https://example.com/x" },
];

const repertoire = {
  ...dates,
  id: "r1",
  name: "Show",
  description: "",
  items: songs.map((song, index) => ({ id: `i${index}`, songId: song.id, source: "personal", position: index + 1, transposeSemitones: 0 })),
};

const share: ShareSummary = {
  id: "share-1",
  repertoireId: "r1",
  name: "Show",
  revision: 3,
  path: "/s/token-exemplo",
  itemCount: 3,
  createdAt: dates.createdAt,
  updatedAt: dates.updatedAt,
  publishedAt: "2026-02-10T12:00:00.000Z",
  authorizedSongIds: ["s1"],
  outdated: false,
  removedTitles: [],
};

const preview = {
  contentHash: HASH,
  snapshot: {
    name: "Show",
    description: "",
    items: [
      { id: "a".repeat(32), position: 1, title: "Com Cifra", artist: "A", originalKey: "G", transposeSemitones: 0, content: { kind: "chordpro", chordPro: "[G]Letra" } },
      { id: "b".repeat(32), position: 2, title: "Autorizada", artist: "B", originalKey: "C", transposeSemitones: 0, content: { kind: "none" } },
      { id: "c".repeat(32), position: 3, title: "Externa", artist: "C", originalKey: "D", transposeSemitones: 0, content: { kind: "external-link", sourceUrl: "https://example.com/x" } },
    ],
  },
};

let shares: ShareSummary[];
let enabled: boolean;
let override: ((path: string, init: RequestInit) => Response | null) | null;
let requests: { path: string; method: string; body: unknown }[];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function writes(): { path: string; method: string; body: unknown }[] {
  return requests.filter((request) => request.method !== "GET");
}

beforeEach(() => {
  accountLibrary.prepareSignOut();
  localStorage.clear();
  auth.getSession.mockReset();
  auth.getSession.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
  shares = [];
  enabled = true;
  override = null;
  requests = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit) => {
      const path = input.replace("/api/v1/library", "");
      const method = init.method ?? "GET";
      requests.push({ path, method, body: init.body ? JSON.parse(String(init.body)) : undefined });

      const custom = override?.(path, init);
      if (custom) {
        return custom;
      }
      if (path === "/songs") {
        return json({ songs });
      }
      if (path === "/repertoires") {
        return json({ repertoires: [repertoire] });
      }
      if (path.endsWith("/preview")) {
        return json({ preview });
      }
      if (path === "/repertoires/r1/shares" && method === "GET") {
        return json({ enabled, shares });
      }
      if (path === "/repertoires/r1/shares" && method === "POST") {
        shares = [share];
        return json({ share }, 201);
      }
      if (path === "/repertoires/r1/shares/share-1" && method === "PUT") {
        return json({ share: { ...share, revision: 4 } });
      }
      if (path === "/repertoires/r1/shares/share-1" && method === "DELETE") {
        shares = [];
        return new Response(null, { status: 204 });
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

async function openInAccount(): Promise<void> {
  await accountLibrary.checkSession();
  await waitFor(() => expect(accountLibrary.getSnapshot().status).toBe("ready"));
  render(<ShareRepertoireScreen repertoireId="r1" />);
  await screen.findByRole("heading", { level: 1, name: "Compartilhar repertório" });
}

async function startNewLink(): Promise<void> {
  await openInAccount();
  fireEvent.click(await screen.findByRole("button", { name: "Criar novo link" }));
  await screen.findByRole("heading", { name: "Nova publicação" });
}

function rights(title: string): HTMLElement {
  return screen.getByRole("checkbox", { name: new RegExp(`cifra de “${title}”`) });
}

describe("nova publicação", () => {
  it("pede confirmação individual só para músicas com cifra", async () => {
    await startNewLink();

    expect(rights("Com Cifra")).toBeDefined();
    expect(rights("Autorizada")).toBeDefined();
    expect(screen.queryByRole("checkbox", { name: /Externa/ })).toBeNull();
    expect(screen.getByText(/só o endereço será publicado/)).toBeDefined();
  });

  it("não marca nenhuma cifra por padrão, nem as do tipo Autorizada", async () => {
    await startNewLink();

    expect((rights("Com Cifra") as HTMLInputElement).checked).toBe(false);
    expect((rights("Autorizada") as HTMLInputElement).checked).toBe(false);
  });

  it("envia somente as confirmações feitas", async () => {
    await startNewLink();
    fireEvent.click(rights("Com Cifra"));

    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    await screen.findByLabelText("Prévia da publicação");

    expect(writes()[0].body).toEqual({
      authorizations: [{ songId: "s1", confirmed: true, declarationVersion: RIGHTS_DECLARATION_VERSION }],
    });
  });

  it("mostra exatamente o que será publicado, e a prévia não cria nada", async () => {
    await startNewLink();
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    const panel = within(await screen.findByLabelText("Prévia da publicação"));

    expect(panel.getByText("Prévia: nada foi publicado ainda.")).toBeDefined();
    expect(panel.getByText("Cifra incluída")).toBeDefined();
    expect(panel.getByText("Somente título, artista e tom")).toBeDefined();
    expect(panel.getByText("https://example.com/x")).toBeDefined();
    expect(panel.getByText(/anotações e seus dados de conta nunca são publicados/)).toBeDefined();
    expect(writes().every((request) => request.path.endsWith("/preview"))).toBe(true);
  });

  it("cancelar antes de publicar não envia nada", async () => {
    await startNewLink();
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    await screen.findByLabelText("Prévia da publicação");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await screen.findByRole("button", { name: "Criar novo link" });
    expect(writes().filter((request) => !request.path.endsWith("/preview"))).toHaveLength(0);
  });

  it("publica com o hash da prévia e exibe o link", async () => {
    await startNewLink();
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    await screen.findByLabelText("Prévia da publicação");

    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));

    const field = (await screen.findByLabelText("Link público de Show")) as HTMLInputElement;
    expect(field.value).toBe(`${window.location.origin}/s/token-exemplo`);
    expect(writes().at(-1)).toMatchObject({ method: "POST", body: { expectedHash: HASH } });
  });

  it("pede nova prévia se o repertório mudou, mantendo as confirmações", async () => {
    await startNewLink();
    fireEvent.click(rights("Com Cifra"));
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    await screen.findByLabelText("Prévia da publicação");

    override = (path, init) =>
      path === "/repertoires/r1/shares" && init.method === "POST"
        ? apiError(409, "conflict", "O repertório mudou depois da prévia.", "share-preview-outdated")
        : null;
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));

    expect(await screen.findByText(/mudou depois da prévia/)).toBeDefined();
    expect(screen.getByRole("heading", { name: "Nova publicação" })).toBeDefined();
    expect((rights("Com Cifra") as HTMLInputElement).checked).toBe(true);
  });
});

describe("publicações existentes", () => {
  beforeEach(() => {
    shares = [share];
  });

  it("mostra a data de publicação e copia o link", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await openInAccount();

    await screen.findByText(/Publicado em 10\/02\/2026/);
    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/token-exemplo`));
  });

  it("sem acesso à área de transferência, mantém o link visível para copiar", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    await openInAccount();

    fireEvent.click(await screen.findByRole("button", { name: "Copiar link" }));

    expect(screen.getByLabelText("Link público de Show")).toBeDefined();
  });

  it("avisa que a publicação difere da biblioteca e cita o que foi removido", async () => {
    shares = [{ ...share, outdated: true, removedTitles: ["Música Retirada"] }];
    await openInAccount();

    expect(await screen.findByText(/continua mostrando a versão anterior/)).toBeDefined();
    expect(screen.getByText(/Música Retirada/)).toBeDefined();
  });

  it("revoga somente depois de confirmar", async () => {
    await openInAccount();

    fireEvent.click(await screen.findByRole("button", { name: "Revogar" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    expect(writes()).toHaveLength(0);

    fireEvent.click(dialog.getByRole("button", { name: "Revogar link" }));

    await screen.findByText("Este repertório ainda não tem links públicos.");
    expect(writes()[0]).toMatchObject({ method: "DELETE" });
  });

  it("na atualização, reaproveita apenas autorizações cujo conteúdo não mudou", async () => {
    await openInAccount();

    fireEvent.click(await screen.findByRole("button", { name: "Atualizar publicação" }));
    await screen.findByRole("heading", { name: "Atualizar publicação" });

    expect((rights("Com Cifra") as HTMLInputElement).checked).toBe(true);
    expect((rights("Autorizada") as HTMLInputElement).checked).toBe(false);
  });

  it("atualiza com a revisão esperada e pede confirmação depois da prévia", async () => {
    await openInAccount();
    fireEvent.click(await screen.findByRole("button", { name: "Atualizar publicação" }));
    await screen.findByRole("heading", { name: "Atualizar publicação" });

    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    await screen.findByLabelText("Prévia da publicação");
    expect(writes().every((request) => request.path.endsWith("/preview"))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar atualização" }));

    await waitFor(() => expect(writes().at(-1)?.method).toBe("PUT"));
    expect(writes().at(-1)?.body).toMatchObject({ expectedRevision: 3, expectedHash: HASH });
  });

  it("em conflito de revisão, recarrega a lista e explica", async () => {
    await openInAccount();
    fireEvent.click(await screen.findByRole("button", { name: "Atualizar publicação" }));
    await screen.findByRole("heading", { name: "Atualizar publicação" });
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    await screen.findByLabelText("Prévia da publicação");

    override = (_path, init) =>
      init.method === "PUT"
        ? apiError(409, "conflict", "Esta publicação foi alterada em outro lugar.", "share-conflict")
        : null;
    fireEvent.click(screen.getByRole("button", { name: "Confirmar atualização" }));

    expect(await screen.findByText(/alterada em outro lugar/)).toBeDefined();
    await screen.findByRole("button", { name: "Criar novo link" });
  });

  it("mostra a falha ao carregar, sem dizer que não há links", async () => {
    override = (path) => (path === "/repertoires/r1/shares" ? apiError(503, "persistence_failed") : null);
    await openInAccount();

    expect(await screen.findByText(/indisponível no momento/)).toBeDefined();
    expect(screen.queryByText("Este repertório ainda não tem links públicos.")).toBeNull();
  });
});

describe("flag desligada", () => {
  it("não oferece criar links, mas mantém a revogação", async () => {
    enabled = false;
    shares = [share];
    await openInAccount();

    expect(await screen.findByText(/não está ativado neste ambiente/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Criar novo link" })).toBeNull();
    expect(screen.getByRole("button", { name: "Revogar" })).toBeDefined();
  });
});
