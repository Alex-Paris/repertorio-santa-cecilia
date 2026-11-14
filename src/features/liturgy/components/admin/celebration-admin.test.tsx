import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { editorialRecord } from "@/test/liturgy-fixtures";

import type { CelebrationRecord } from "../../domain/celebration-record";
import { CelebrationAdminScreen, CelebrationCreateScreen } from "./celebration-admin";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

interface Call {
  url: string;
  method: string;
  ifMatch: string | null;
  body: unknown;
}

const calls: Call[] = [];
let record: CelebrationRecord;
let writeResponse: (call: Call) => Response;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const HISTORY = [
  {
    id: "h1",
    celebrationId: "2026-11-22-cristo-rei",
    action: "import",
    fromRevision: null,
    toRevision: 1,
    fromStatus: null,
    toStatus: "pending_review",
    changedFields: ["readings", "sources"],
    actor: "importacao-editorial",
    at: "2026-11-14T10:00:00.000Z",
  },
];

beforeEach(() => {
  calls.length = 0;
  router.replace.mockClear();
  record = editorialRecord("2026-11-22");
  writeResponse = () => json({ celebration: record });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const call = {
        url,
        method: init.method ?? "GET",
        ifMatch: new Headers(init.headers).get("if-match"),
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      if (call.method !== "GET") {
        return writeResponse(call);
      }
      return url.endsWith("/history") ? json({ history: HISTORY }) : json({ celebration: record });
    }),
  );
});

const writes = () => calls.filter((call) => call.method !== "GET");

async function openScreen(): Promise<void> {
  render(<CelebrationAdminScreen userId="admin-1" celebrationId="2026-11-22-cristo-rei" />);
  await screen.findByRole("heading", { name: "Revisão editorial" });
}

function chooseAction(label: string): void {
  fireEvent.change(screen.getByLabelText("Ação"), { target: { value: label } });
}

describe("revisão editorial", () => {
  it("mostra o estado, o que não tem fonte e o histórico", async () => {
    await openScreen();
    const panel = screen.getByRole("region", { name: "Revisão editorial" });

    expect(within(panel).getByText("Em revisão")).toBeDefined();
    expect(within(panel).getByText(/Sem fonte que confirme: tempo litúrgico, ciclo do lecionário/)).toBeDefined();
    expect(await screen.findByText("Importação editorial · revisão — → 1")).toBeDefined();
    expect(screen.getByText("Campos: Leituras, Fontes")).toBeDefined();
  });

  it("a aprovação exige a confirmação de conferência humana e envia a revisão conferida", async () => {
    writeResponse = () =>
      json({
        celebration: {
          ...record,
          reviewStatus: "reviewed",
          revision: 2,
          approval: { by: "admin-1", at: "2026-11-14T12:00:00.000Z", revision: 1, sourceIds: ["cancao-nova"] },
        },
      });
    await openScreen();
    chooseAction("approve");

    const sources = screen.getByRole("group", { name: /Fontes que fundamentam a aprovação/ });
    fireEvent.click(within(sources).getByRole("checkbox", { name: "cancao-nova: Canção Nova" }));
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    // Sem a confirmação, o servidor recusaria; a tela envia exatamente o que a pessoa marcou.
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({
      url: "/api/v1/admin/liturgy/celebrations/2026-11-22-cristo-rei/review",
      method: "POST",
      ifMatch: '"1"',
      body: { action: "approve", humanReviewConfirmed: false, sourceIds: ["cancao-nova"] },
    });
  });

  it("aprovada, mostra quem aprovou, a revisão e as fontes", async () => {
    writeResponse = () =>
      json({
        celebration: {
          ...record,
          reviewStatus: "reviewed",
          revision: 2,
          approval: { by: "admin-1", at: "2026-11-14T12:00:00.000Z", revision: 1, sourceIds: ["cancao-nova"] },
        },
      });
    await openScreen();
    chooseAction("approve");
    fireEvent.click(screen.getByRole("checkbox", { name: "cancao-nova: Canção Nova" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Conferi pessoalmente/ }));
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    expect(await screen.findByText(/pela conta admin-1, sobre a revisão 1, com base em: cancao-nova/)).toBeDefined();
    expect(writes()[0].body).toMatchObject({ humanReviewConfirmed: true });
    expect(screen.getByRole("option", { name: "Reabrir revisão" })).toBeDefined();
  });

  it("divergência pede os campos e uma observação", async () => {
    await openScreen();
    chooseAction("dispute");
    fireEvent.click(within(screen.getByRole("group", { name: /Dados em divergência/ })).getByRole("checkbox", { name: "Salmo responsorial" }));
    fireEvent.change(screen.getByLabelText("Observação"), { target: { value: "O Diretório indica outro salmo." } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar divergência" }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].body).toEqual({ action: "dispute", fields: ["psalm"], note: "O Diretório indica outro salmo." });
  });

  it("com alterações não salvas no conteúdo, a revisão fica bloqueada", async () => {
    await openScreen();
    fireEvent.change(screen.getByRole("textbox", { name: "Título" }), { target: { value: "Cristo Rei do Universo" } });

    expect(await screen.findByText("Salve ou desfaça as alterações do conteúdo antes de revisar.")).toBeDefined();
    expect(screen.queryByLabelText("Ação")).toBeNull();
  });

  it("editar envia o conteúdo com a revisão; uma revisão desatualizada não sobrescreve", async () => {
    writeResponse = () => json({ error: { code: "precondition_failed", message: "x" } }, 412);
    await openScreen();
    fireEvent.change(screen.getByRole("textbox", { name: "Título" }), { target: { value: "Cristo Rei do Universo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText(/alterada por outra pessoa da administração/)).toBeDefined();
    expect(writes()[0]).toMatchObject({ method: "PUT", ifMatch: '"1"' });
    expect((writes()[0].body as { celebration: { title: string } }).celebration.title).toBe("Cristo Rei do Universo");
    expect(writes()[0].body).not.toHaveProperty("celebration.reviewStatus");
    expect(writes()[0].body).not.toHaveProperty("celebration.id");
  });
});

describe("nova celebração", () => {
  it("exige fonte e não deixa registrar leitura sem fonte", async () => {
    render(<CelebrationCreateScreen userId="admin-1" />);
    fireEvent.change(screen.getByLabelText(/^Data/), { target: { value: "2027-06-29" } });
    fireEvent.change(screen.getByLabelText(/^Chave da celebração/), { target: { value: "sao-pedro-e-sao-paulo" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Título" }), { target: { value: "São Pedro e São Paulo" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar celebração" }));
    expect(screen.getByRole("alert").textContent).toContain("Registre ao menos uma fonte.");

    fireEvent.click(screen.getByRole("button", { name: "Adicionar fonte" }));
    fireEvent.change(screen.getByLabelText("Quem publica"), { target: { value: "CNBB" } });
    fireEvent.change(screen.getByLabelText("Título do documento"), { target: { value: "Diretório da Liturgia 2027" } });
    fireEvent.click(within(screen.getByRole("group", { name: /O que esta fonte confirma/ })).getByRole("checkbox", { name: "Título" }));

    fireEvent.change(screen.getByLabelText("Situação: Evangelho"), { target: { value: "registered" } });
    fireEvent.change(screen.getByLabelText(/^Citação: Evangelho/), { target: { value: "Mt 16,13-19" } });
    const gospel = screen.getByRole("group", { name: "Trechos: Evangelho" });
    fireEvent.change(within(gospel).getByLabelText("Livro"), { target: { value: "mt" } });
    fireEvent.change(within(gospel).getByLabelText("Capítulo"), { target: { value: "16" } });
    fireEvent.click(within(gospel).getByRole("button", { name: "Adicionar referência" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar celebração" }));
    expect(screen.getByRole("alert").textContent).toContain("Toda leitura registrada precisa de uma fonte que a confirme.");
    expect(writes()).toEqual([]);

    fireEvent.click(within(screen.getByRole("group", { name: /O que esta fonte confirma/ })).getByRole("checkbox", { name: "Evangelho" }));
    writeResponse = () => json({ celebration: { ...record, id: "nova-id" } }, 201);
    fireEvent.click(screen.getByRole("button", { name: "Criar celebração" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin/liturgia/nova-id"));
    const body = writes()[0].body as { celebration: Record<string, unknown> };
    expect(body.celebration).toMatchObject({
      date: "2027-06-29",
      celebrationKey: "sao-pedro-e-sao-paulo",
      readings: [{ role: "gospel", citation: "Mt 16,13-19", ranges: [{ book: "mt", chapter: 16 }] }],
      sources: [{ id: "fonte-1", provider: "CNBB", scope: ["title", "gospel"], verificationStatus: "human-check" }],
    });
    expect(body.celebration).not.toHaveProperty("reviewStatus");
  });
});
