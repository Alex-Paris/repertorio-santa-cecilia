import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeAccount } from "@/test/fake-account-api";
import { editorialContext, reviewedContext } from "@/test/liturgy-fixtures";
import { openAccount } from "@/test/open-account";

import { CelebrationCard } from "./celebration-card";
import { CelebrationList } from "./celebration-picker";
import { MassCelebrationStatus } from "./mass-celebration-status";
import { MassPlanner } from "./mass-planner";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

describe("estado editorial na tela pública", () => {
  it("A. revisada: informa a revisão editorial, sem afirmar publicação oficial", () => {
    render(<CelebrationCard context={reviewedContext("2026-11-22")} />);
    expect(screen.getByText("Celebração revisada")).toBeDefined();
    expect(screen.getByText(/não uma publicação oficial/)).toBeDefined();
  });

  it("B. em revisão: informa o estado e mostra a fonte consultada", () => {
    render(<CelebrationCard context={editorialContext("2026-11-22")} />);
    expect(screen.getByText("Dados em revisão")).toBeDefined();
    expect(screen.getByText(/ainda não passaram por revisão humana/)).toBeDefined();
    expect(screen.getByRole("link", { name: /Canção Nova — Liturgia Diária/ }).getAttribute("href")).toContain("cancaonova");
    expect(screen.getByText(/Fonte do Brasil · consultada em 11 de novembro de 2026 · comparação automatizada/)).toBeDefined();
  });

  it("C. com divergência: aponta o que diverge e marca a leitura", () => {
    const context = editorialContext("2026-11-22", {
      reviewStatus: "disputed",
      dispute: { fields: ["psalm"], note: "NOTA INTERNA", by: "admin", at: "2026-11-14T00:00:00.000Z" },
    });
    render(<CelebrationCard context={context} />);
    expect(screen.getByText("Dados com divergência")).toBeDefined();
    expect(screen.getByText("(em divergência)")).toBeDefined();
    expect(document.body.textContent).not.toContain("NOTA INTERNA");
  });

  it("em atualização: avisa que precisa ser atualizada", () => {
    render(<CelebrationCard context={editorialContext("2026-11-22", { reviewStatus: "needs_update" })} />);
    expect(screen.getByText("Dados em atualização")).toBeDefined();
  });

  it("não esconde o que falta nem o que é inferência", () => {
    render(<CelebrationCard context={editorialContext("2026-12-06")} />);
    expect(
      screen.getByText(/Não confirmado em fonte do Brasil ou universal: título, grau, tempo litúrgico, cor litúrgica, ciclo do lecionário/),
    ).toBeDefined();
    expect(screen.getByText(/Fonte de outro país/)).toBeDefined();
  });

  it("a lista mostra a situação de cada celebração", () => {
    const pending = editorialContext("2026-11-29");
    render(
      <CelebrationList
        title="Celebrações"
        celebrations={[
          { ...pending, reviewStatus: "pending_review", color: "roxo" },
          { ...reviewedContext("2026-11-22"), reviewStatus: "reviewed", color: "branco" },
        ]}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows[0].textContent).toContain("Em revisão");
    expect(rows[1].textContent).toContain("Revisada");
    expect(within(rows[0]).getByRole("link").getAttribute("href")).toBe(
      "/preparar-missa?data=2026-11-29&celebracao=2026-11-29-1-domingo-advento",
    );
  });
});

describe("sugestões provisórias", () => {
  beforeEach(async () => {
    await openAccount({ songs: [], repertoires: [] });
  });

  it("informa por que as sugestões não são definitivas", () => {
    render(
      <MassPlanner
        celebration={{ date: "2026-12-20", celebrationId: "x", title: "4º Domingo do Advento", revision: 3 }}
        moments={[]}
        assurance="provisional"
        cautions={["Ainda não conferido: salmo responsorial. Nada é sugerido no lugar."]}
        activeMoment={null}
        repertoireId={null}
      />,
    );
    const note = screen.getByText("Sugestões provisórias").closest("div") as HTMLElement;
    expect(within(note).getByText("Ainda não conferido: salmo responsorial. Nada é sugerido no lugar.")).toBeDefined();
  });

  it("com variantes, o endereço guarda a celebração escolhida", () => {
    render(
      <MassPlanner
        celebration={{ date: "2026-12-25", celebrationId: "natal-noite", title: "Natal", hasVariants: true }}
        moments={[]}
        activeMoment={null}
        repertoireId={null}
      />,
    );
    // Sem sugestões carregadas para o momento, a aba busca a lista dele no mesmo endereço.
    fireEvent.click(screen.getByRole("tab", { name: "Comunhão" }));
    expect(router.push).toHaveBeenCalledWith("/preparar-missa?data=2026-12-25&celebracao=natal-noite&momento=comunhao", {
      scroll: false,
    });
  });

  it("o repertório criado guarda a revisão da celebração", async () => {
    render(
      <MassPlanner
        celebration={{ date: "2026-11-22", celebrationId: "2026-11-22-cristo-rei", title: "Cristo Rei", revision: 4 }}
        moments={[]}
        activeMoment={null}
        repertoireId={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Montar o repertório desta missa/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Criar repertório" }));
    await waitFor(() => expect(fakeAccount.library().repertoires).toHaveLength(1));
    expect(fakeAccount.library().repertoires[0].mass).toEqual({
      date: "2026-11-22",
      celebrationId: "2026-11-22-cristo-rei",
      title: "Cristo Rei",
      celebrationRevision: 4,
    });
  });
});

describe("repertório com celebração atualizada", () => {
  function respond(body: unknown, status = 200) {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
  }

  const mass = { date: "2026-11-22", celebrationId: "2026-11-22-cristo-rei", title: "Cristo Rei", celebrationRevision: 1 };

  it("avisa quando a celebração mudou, sem alterar as escolhas", async () => {
    respond({ celebration: { ...reviewedContext("2026-11-22"), revision: 3 } });
    render(<MassCelebrationStatus mass={mass} repertoireId="rep-1" />);

    expect(await screen.findByText(/foi atualizada ou revisada depois que este repertório foi montado/)).toBeDefined();
    expect(screen.getByText(/Suas músicas, tons e anotações não foram alterados/)).toBeDefined();
    expect(screen.getAllByText("Revisada").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Ver a celebração atual" }).getAttribute("href")).toBe(
      "/preparar-missa?data=2026-11-22&celebracao=2026-11-22-cristo-rei&repertorio=rep-1",
    );
  });

  it("sem mudança, só mostra a situação", async () => {
    respond({ celebration: { ...editorialContext("2026-11-22"), revision: 1 } });
    render(<MassCelebrationStatus mass={mass} repertoireId="rep-1" />);
    expect((await screen.findAllByText("Em revisão")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/foi atualizada/)).toBeNull();
  });

  it("celebração fora da base: o repertório continua como está", async () => {
    respond({ error: { code: "not_found", message: "x" } }, 404);
    render(<MassCelebrationStatus mass={mass} repertoireId="rep-1" />);
    expect(await screen.findByText(/não está na base de celebrações agora/)).toBeDefined();
  });

  it("repertório antigo, sem celebração vinculada, não consulta nada", () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const { container } = render(<MassCelebrationStatus mass={{ date: "2026-12-06", title: "Missa" }} repertoireId="rep-1" />);
    expect(spy).not.toHaveBeenCalled();
    expect(container.textContent).toBe("");
  });
});
