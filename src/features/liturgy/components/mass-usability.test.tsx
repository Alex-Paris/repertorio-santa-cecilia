import { LITURGICAL_MOMENTS } from "../domain/vocabulary";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeAccount } from "@/test/fake-account-api";
import { editorialContext, reviewedContext } from "@/test/liturgy-fixtures";
import { openAccount } from "@/test/open-account";

import { EMPTY_CLASSIFICATION_INPUT, type PublicSongClassification } from "../domain/classification";
import { suggestForCelebration, type SuggestionCandidate } from "../domain/recommendation";
import { CelebrationNotice } from "./celebration-card";
import { MassPlanner } from "./mass-planner";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

const KING = editorialContext("2026-11-22");
const CELEBRATION = { date: KING.date, celebrationId: KING.celebrationId, title: KING.title };

function liturgy(fields: Partial<PublicSongClassification>): PublicSongClassification {
  const { editorialRationale, ...rest } = EMPTY_CLASSIFICATION_INPUT;
  void editorialRationale;
  return { ...rest, ...fields };
}

const song = (id: string, title: string, moments: PublicSongClassification["moments"]): SuggestionCandidate => ({
  id,
  title,
  artist: "Grupo Fictício",
  originalKey: "C",
  contentType: "original",
  hasChordPro: true,
  liturgy: liturgy({ moments }),
});

const ENTRADA = song("cat-entrada", "Portas Fictícias", ["entrada"]);
const COMUNHAO_A = song("cat-a", "Mesa Fictícia", ["comunhao"]);
const COMUNHAO_B = song("cat-b", "Pão Fictício", ["comunhao"]);

function renderPlanner(candidates: SuggestionCandidate[]) {
  return render(
    <MassPlanner celebration={CELEBRATION} moments={suggestForCelebration(KING, candidates)} activeMoment={null} repertoireId={null} />,
  );
}

function openMoment(name: string): HTMLElement {
  const moment = LITURGICAL_MOMENTS.find(item => item.label === name);
  if (!moment) throw new Error(`Momento desconhecido: ${name}`);
  fireEvent.change(screen.getByRole("combobox", {name:"Momento da missa"}), {target:{value:moment.id}});
  return screen.getByRole("region", {name:`Sugestões para ${name}`});
}


beforeEach(async () => {
  router.push.mockClear();
  await openAccount({ songs: [], repertoires: [] });
});

describe("aviso editorial único", () => {
  it("mostra a situação e a marca de provisória à vista; motivos, leituras e fontes no mesmo bloco", () => {
    render(
      <CelebrationNotice
        context={KING}
        assurance="provisional"
        cautions={["Há músicas sugeridas com classificação ainda não conferida por uma pessoa da equipe."]}
      />,
    );
    const notice = screen.getByRole("region", { name: KING.title });
    const summary = notice.querySelector("summary") as HTMLElement;
    expect(summary.textContent).toContain("Dados em revisão");
    expect(summary.textContent).toContain("ainda sem revisão humana");
    expect(summary.textContent).toContain("Sugestões provisórias");
    // Nada é omitido: o texto completo, os motivos e as fontes ficam no bloco.
    expect(notice.textContent).toContain("ainda não passaram por revisão humana");
    const reasons = within(notice).getAllByRole("note").find((note) => note.textContent?.includes("Por que as sugestões são provisórias"));
    expect(reasons?.textContent).toContain("classificação ainda não conferida");
    expect(within(notice).getByText("Mt 25,31-46")).toBeDefined();
    expect(within(notice).getByRole("link", { name: /Canção Nova/ })).toBeDefined();
    expect(notice.querySelectorAll("details")[0].open).toBe(false);
  });

  it("celebração revisada e sugestões definitivas: sem marca de provisória", () => {
    const reviewed = reviewedContext("2026-11-22");
    render(<CelebrationNotice context={reviewed} assurance="definitive" cautions={[]} />);
    const summary = screen.getByRole("region", { name: reviewed.title }).querySelector("summary") as HTMLElement;
    expect(summary.textContent).toContain("Celebração revisada");
    expect(summary.textContent).not.toContain("Sugestões provisórias");
  });

  it("com o aviso único, o planejador não repete os motivos", () => {
    render(
      <MassPlanner
        celebration={CELEBRATION}
        moments={suggestForCelebration(KING, [ENTRADA])}
        assurance="provisional"
        cautions={["Motivo fictício"]}
        cautionsInIntro
        activeMoment={null}
        repertoireId={null}
      />,
    );
    expect(screen.queryByText("Motivo fictício")).toBeNull();
    expect(screen.queryByText("Sugestões provisórias")).toBeNull();
  });
});

describe("sugestões conforme a quantidade", () => {
  it("uma ou várias músicas mantêm a lista legível e suas ações", () => {
    renderPlanner([ENTRADA, COMUNHAO_A, COMUNHAO_B]);
    const entrance = screen.getByRole("region", { name: "Sugestões para Entrada" });
    expect(within(entrance).getAllByRole("button",{name:/^Adicionar .* ao repertório/})).toHaveLength(1);

    const communion = openMoment("Comunhão");
    expect(within(communion).getByText("Mesa Fictícia")).toBeDefined();
    expect(within(communion).getByText("Pão Fictício")).toBeDefined();
    expect(within(communion).getAllByRole("button", { name: /^Adicionar .* ao repertório/ })).toHaveLength(2);
  });

  it("momento sem músicas oferece os momentos que têm sugestões, sem inventar resultados", () => {
    renderPlanner([ENTRADA, COMUNHAO_A]);
    const offertory = openMoment("Preparação das oferendas");
    expect(within(offertory).queryAllByRole("listitem").filter((item) => item.querySelector("[aria-label^='Adicionar']"))).toEqual([]);
    expect(within(offertory).getByRole("link", { name: "Buscar no catálogo" }).getAttribute("href")).toBe(
      "/catalogo?momento=preparacao-das-oferendas",
    );

    fireEvent.click(within(offertory).getByRole("button", { name: /Comunhão/ }));
    expect((screen.getByRole("combobox", {name:"Momento da missa"}) as HTMLSelectElement).value).toBe("comunhao");
    expect(document.activeElement).toBe(screen.getByRole("combobox", {name:"Momento da missa"}));
  });
});

describe("navegação pelos onze momentos", () => {
  it("oferece os onze momentos sem esconder opções numa fileira horizontal", () => {
    renderPlanner([ENTRADA,COMUNHAO_A,COMUNHAO_B]);
    const selector=screen.getByRole("combobox",{name:"Momento da missa"});
    expect(within(selector).getAllByRole("option")).toHaveLength(11);
    expect(within(selector).getAllByRole("option").map(option=>option.textContent)).toEqual(LITURGICAL_MOMENTS.map(moment=>moment.label));
  });
  it("o seletor permanece na ordem normal de foco", () => {
    renderPlanner([ENTRADA]);
    const selector=screen.getByRole("combobox",{name:"Momento da missa"});
    expect(selector.tabIndex).toBe(0);
    expect(screen.queryByRole("button",{name:"Ver próximos momentos"})).toBeNull();
  });
});

describe("repertório em construção", () => {
  it("estado inicial simples: uma frase, o nome e o botão de criar", async () => {
    renderPlanner([ENTRADA]);
    fireEvent.click(screen.getByRole("button", { name: /Montar o repertório desta missa/ }));
    const panel = screen.getByRole("dialog", { name: "Repertório em construção" });
    expect(await within(panel).findByText(/Crie o repertório desta missa/)).toBeDefined();
    expect(within(panel).getByLabelText("Nome do repertório")).toBeDefined();
    expect(within(panel).getByRole("button", { name: "Criar repertório" })).toBeDefined();
  });

  it("informa que está salvo na conta, numa linha só com a troca de repertório", async () => {
    const created = await fakeAccount.otherDevice().repertoires.create({
      name: "Missa fictícia",
      description: "",
      mass: { date: KING.date, title: KING.title },
    });
    await openAccount(fakeAccount.library());
    render(
      <MassPlanner
        celebration={CELEBRATION}
        moments={suggestForCelebration(KING, [ENTRADA])}
        activeMoment={null}
        repertoireId={created.id}
      />,
    );
    fireEvent.click(screen.getByRole("button",{name:/^Abrir repertório desta missa,/i}));
    const panel = screen.getByRole("dialog", { name: "Repertório em construção" });
    expect((await within(panel).findByRole("status")).textContent).toContain("Salvo na sua conta");
    expect(within(panel).getByRole("button", { name: "Trocar de repertório" })).toBeDefined();
    expect(within(panel).queryByText(/Tudo o que aparece aqui/)).toBeNull();
  });
});
