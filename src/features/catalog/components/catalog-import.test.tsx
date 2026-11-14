import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogImport } from "./catalog-import";

const DOCUMENT = {
  format: "repertorio-web/catalogo-editorial",
  version: 1,
  records: [{ importKey: "teste-a", title: "Canto A", artist: "", contentType: "metadata-only", metadataSources: [{ title: "Fonte" }] }],
};

const PREVIEW = {
  entries: [
    { index: 0, importKey: "teste-a", title: "Canto A", artist: "", status: "new", sources: [{ title: "Fonte fictícia", url: "https://example.com/f" }] },
    {
      index: 1,
      importKey: "teste-b",
      title: "Canto B",
      artist: "X",
      status: "duplicate",
      reason: "Já existe uma música com o mesmo título e autoria compatível. Confira antes de importar.",
      sources: [],
      existing: { id: "cat-b", title: "Canto B", artist: "X" },
    },
  ],
  counts: { new: 1, existing: 0, duplicate: 1, invalid: 0 },
};

const calls: { url: string; method: string; body: unknown }[] = [];

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method: init.method ?? "GET", body });
      const payload = url.endsWith("/import/preview")
        ? { preview: PREVIEW }
        : { result: { ...PREVIEW, created: [{ id: "cat-a", importKey: "teste-a", title: "Canto A" }] } };
      return new Response(JSON.stringify(payload), { status: url.endsWith("/import") ? 201 : 200 });
    }),
  );
});

describe("importação de metadados", () => {
  it("prévia primeiro, sem gravar; a importação exige confirmação explícita", async () => {
    render(<CatalogImport userId="admin-1" bundled={DOCUMENT} />);

    fireEvent.click(screen.getByRole("button", { name: "Usar o catálogo editorial inicial" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));

    expect(await screen.findByText(/1 novas · 0 já importadas · 1 possíveis duplicatas · 0 inválidas. Nada foi gravado./)).toBeDefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: "/api/v1/admin/catalog/import/preview", method: "POST", body: { document: DOCUMENT } });
    expect(screen.getByRole("link", { name: "Fonte fictícia" }).getAttribute("href")).toBe("https://example.com/f");
    expect(screen.getByText("Possível duplicata")).toBeDefined();
    expect(screen.getByRole("link", { name: "Canto B" }).getAttribute("href")).toBe("/admin/catalogo/cat-b");

    const commit = screen.getByRole("button", { name: "Importar rascunhos" }) as HTMLButtonElement;
    expect(commit.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /Conferi a prévia. Criar 1 rascunho/ }));
    fireEvent.click(commit);

    expect(await screen.findByText(/1 rascunho criado/)).toBeDefined();
    expect(calls[1]).toMatchObject({ url: "/api/v1/admin/catalog/import", method: "POST", body: { document: DOCUMENT, confirm: true } });
    expect(screen.getByRole("link", { name: "Canto A" }).getAttribute("href")).toBe("/admin/catalogo/cat-a");
  });

  it("conteúdo que não é JSON não vai ao servidor", async () => {
    render(<CatalogImport userId="admin-1" bundled={DOCUMENT} />);
    fireEvent.change(screen.getByLabelText("Conteúdo"), { target: { value: "{ não é json" } });
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("O conteúdo não é um JSON válido."));
    expect(calls).toEqual([]);
  });

  it("alterar o conteúdo descarta a prévia anterior", async () => {
    render(<CatalogImport userId="admin-1" bundled={DOCUMENT} />);
    fireEvent.click(screen.getByRole("button", { name: "Usar o catálogo editorial inicial" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    await screen.findByText(/Nada foi gravado/);

    fireEvent.change(screen.getByLabelText("Conteúdo"), { target: { value: "{}" } });
    expect(screen.queryByRole("button", { name: "Importar rascunhos" })).toBeNull();
  });
});
