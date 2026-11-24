import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogSong } from "../domain/catalog-song";
import { CatalogSongEditor } from "./catalog-admin";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const published: CatalogSong = {
  id: "cat-1",
  title: "Publicada",
  artist: "Banda Imaginária",
  originalKey: "G",
  contentType: "original",
  chordPro: "[G]Letra",
  status: "published",
  rights: {
    basis: "original-work",
    evidence: "Obra da casa",
    displayChordPro: true,
    shareChordPro: false,
    linkExternalSource: true,
    approvedBy: "admin-1",
    approvedAt: "2026-11-01T00:00:00.000Z",
  },
  revision: 3,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  publishedAt: "2026-11-01T00:00:00.000Z",
  liturgy: null,
  metadataSources: [],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const calls: { url: string; method: string; ifMatch: string | null; userHeader: string | null; body?: unknown }[] = [];

function stubServer(onWrite: () => Response, initial: CatalogSong = published): void {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      calls.push({
        url,
        method: init.method ?? "GET",
        ifMatch: headers.get("if-match"),
        userHeader: headers.get("x-repertorio-expected-user"),
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      });
      return (init.method ?? "GET") === "GET" ? json({ song: initial }) : onWrite();
    }),
  );
}

beforeEach(() => router.replace.mockClear());

describe("editor do catálogo", () => {
  it("trava o tom depois da primeira publicação", async () => {
    stubServer(() => json({ song: published }));
    render(<CatalogSongEditor userId="admin-1" songId="cat-1" />);

    const key = (await screen.findByLabelText(/Tom original/)) as HTMLSelectElement;
    expect(key.disabled).toBe(true);
    expect(screen.getByText(/mudar o tom alteraria os tons escolhidos/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Despublicar" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull();
  });

  it("envia a revisão carregada e mostra o conflito sem sobrescrever", async () => {
    stubServer(() => json({ error: { code: "revision_conflict", message: "Alterada." } }, 412));
    render(<CatalogSongEditor userId="admin-1" songId="cat-1" />);

    fireEvent.change(await screen.findByLabelText("Título"), { target: { value: "Novo título" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText(/alterada por outra pessoa da administração/)).toBeDefined();
    const write = calls.find((call) => call.method === "PUT");
    expect(write).toMatchObject({ url: "/api/v1/admin/catalog/songs/cat-1", ifMatch: '"3"', userHeader: "admin-1" });
  });

  it("despublicar usa a rota própria e atualiza a situação", async () => {
    stubServer(() => json({ song: { ...published, status: "unpublished", revision: 4 } }));
    render(<CatalogSongEditor userId="admin-1" songId="cat-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Despublicar" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Publicar" })).toBeDefined());
    expect(calls.find((call) => call.method === "POST")?.url).toBe("/api/v1/admin/catalog/songs/cat-1/unpublish");
  });

  it("uma conta sem permissão vê o erro do servidor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: { code: "catalog_admin_required", message: "Sem permissão." } }, 403)),
    );
    render(<CatalogSongEditor userId="user-x" songId="cat-1" />);

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.queryByLabelText("Título")).toBeNull();
  });
});

describe("cadastro simplificado", () => {
  const draft: CatalogSong = {
    ...published,
    id: "cat-novo",
    title: "Canto Só Identificado",
    artist: "",
    contentType: "metadata-only",
    chordPro: undefined,
    originalKey: undefined,
    status: "draft",
    publishedAt: null,
    revision: 1,
    rights: { ...published.rights, basis: "public-metadata", evidence: "", displayChordPro: false },
    metadataSources: [{ title: "Fonte fictícia", url: "https://example.com/fonte" }],
  } as unknown as CatalogSong;

  it("cria um rascunho só com título e fonte, sem cifra, sem tom e sem autoria", async () => {
    stubServer(() => json({ song: draft }, 201));
    render(<CatalogSongEditor userId="admin-1" />);

    expect(screen.getByRole("navigation", { name: "Etapas do cadastro" })).toBeDefined();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Canto Só Identificado" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar fonte consultada" }));
    fireEvent.change(screen.getByLabelText("Fonte 1"), { target: { value: "Fonte fictícia" } });
    fireEvent.change(screen.getByLabelText("Endereço (opcional)"), { target: { value: "https://example.com/fonte" } });
    expect(screen.getByRole<HTMLInputElement>("radio", { name: /Somente metadados/ }).checked).toBe(true);
    expect((screen.getByLabelText("Tom original") as HTMLSelectElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Criar rascunho" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin/catalogo/cat-novo"));
    const write = calls.find((call) => call.method === "POST");
    expect(write?.url).toBe("/api/v1/admin/catalog/songs");
    expect(write?.body).toEqual({
      song: { title: "Canto Só Identificado", artist: "", contentType: "metadata-only" },
      video: null,
      metadataSources: [{ title: "Fonte fictícia", url: "https://example.com/fonte" }],
      rights: {
        basis: "public-metadata",
        evidence: "",
        displayChordPro: false,
        shareChordPro: false,
        linkExternalSource: false,
      },
    });
  });

  it("cadastra o vídeo junto com a nova música, inclusive sem cifra", async () => {
    stubServer(() => json({ song: draft }, 201));
    render(<CatalogSongEditor userId="admin-1" />);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Canto com vídeo" } });
    fireEvent.change(screen.getByLabelText("Link do YouTube (opcional)"), { target: { value: "https://youtu.be/abcdefghijk" } });
    fireEvent.change(screen.getByLabelText("Título do vídeo (opcional)"), { target: { value: " Ensaio " } });
    fireEvent.click(screen.getByRole("button", { name: "Criar rascunho" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    const writes = calls.filter((call) => call.method !== "GET");
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ method: "POST", url: "/api/v1/admin/catalog/songs", body: { video: { url: "https://youtu.be/abcdefghijk", title: "Ensaio" } } });
  });

  it("um link inválido mostra erro sem criar um rascunho parcial", () => {
    stubServer(() => json({ song: draft }, 201));
    render(<CatalogSongEditor userId="admin-1" />);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Canto com vídeo" } });
    fireEvent.change(screen.getByLabelText("Link do YouTube (opcional)"), { target: { value: "https://example.com/invalido" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar rascunho" }));
    expect(screen.getByRole("alert").textContent).toContain("link HTTPS válido");
    expect(calls.filter((call) => call.method !== "GET")).toEqual([]);
  });

  it("carrega e permite trocar o vídeo no formulário de edição", async () => {
    const initial: CatalogSong = { ...published, video: { provider: "youtube", videoId: "abcdefghijk", title: "Vídeo anterior", kind: "reference", approvedBy: "admin-1", approvedAt: published.createdAt } };
    stubServer(() => json({ song: initial }), initial);
    render(<CatalogSongEditor userId="admin-1" songId="cat-1" />);
    const input = await screen.findByLabelText<HTMLInputElement>("Link do YouTube (opcional)");
    expect(input.value).toBe("https://www.youtube.com/watch?v=abcdefghijk");
    expect(screen.getByLabelText<HTMLInputElement>("Título do vídeo (opcional)").value).toBe("Vídeo anterior");
    fireEvent.change(input, { target: { value: "https://www.youtube.com/shorts/lmnopqrstuv" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(calls.find((call) => call.method === "PUT")).toMatchObject({ url: "/api/v1/admin/catalog/songs/cat-1", ifMatch: '"3"', body: { video: { url: "https://www.youtube.com/shorts/lmnopqrstuv", title: "Vídeo anterior" } } }));
  });

  it("apagar o link remove a referência na mesma gravação da música", async () => {
    const initial: CatalogSong = { ...published, video: { provider: "youtube", videoId: "abcdefghijk", kind: "reference", approvedBy: "admin-1", approvedAt: published.createdAt } };
    stubServer(() => json({ song: published }), initial);
    render(<CatalogSongEditor userId="admin-1" songId="cat-1" />);
    fireEvent.change(await screen.findByLabelText("Link do YouTube (opcional)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(calls.find((call) => call.method === "PUT")?.body).toMatchObject({ video: null }));
  });

  it("cifra própria exige o tom real; nada é suposto", () => {
    stubServer(() => json({ song: draft }, 201));
    render(<CatalogSongEditor userId="admin-1" />);

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Com Cifra" } });
    fireEvent.click(screen.getByRole("radio", { name: /Cifra própria ou autorizada/ }));
    fireEvent.click(screen.getByRole("button", { name: "Criar rascunho" }));

    expect(screen.getByRole("alert").textContent).toContain("Escolha o tom original");
    expect(calls.filter((call) => call.method !== "GET")).toEqual([]);
  });

  it("link externo tem a permissão de mostrar o link separada da cifra", () => {
    stubServer(() => json({ song: draft }, 201));
    render(<CatalogSongEditor userId="admin-1" />);

    fireEvent.click(screen.getByRole("radio", { name: /Link para cifra externa/ }));
    expect(screen.getByRole("checkbox", { name: "Mostrar o link para a fonte externa" })).toBeDefined();
    expect(screen.queryByRole("checkbox", { name: /Exibir a letra e a cifra/ })).toBeNull();
  });

  it("rascunho sem evidência de direitos não pode ser publicado, e as etapas C e D aparecem", async () => {
    stubServer(() => json({ song: draft }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ song: draft })),
    );
    render(<CatalogSongEditor userId="admin-1" songId="cat-novo" />);

    expect(await screen.findByText("Registre a evidência dos direitos antes de publicar.")).toBeDefined();
    expect((screen.getByRole("button", { name: "Publicar" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("heading", { name: "C. Classificação litúrgica" })).toBeDefined();
    expect(screen.getByText(/Classifique a música \(etapa C\)/)).toBeDefined();
  });
});

