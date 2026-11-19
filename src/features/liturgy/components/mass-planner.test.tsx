import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogSongView } from "@/features/library/domain/library";
import { toastStore } from "@/lib/utils/toast";
import { fakeAccount } from "@/test/fake-account-api";
import { editorialContext } from "@/test/liturgy-fixtures";
import { openAccount, openSignedOut } from "@/test/open-account";

import type { LiturgicalCelebrationContext } from "../domain/calendar";
import { EMPTY_CLASSIFICATION_INPUT, type PublicSongClassification } from "../domain/classification";
import { suggestForCelebration, type SuggestionCandidate } from "../domain/recommendation";
import type { LiturgicalMomentId } from "../domain/vocabulary";
import { CelebrationCard } from "./celebration-card";
import { MassPlanner } from "./mass-planner";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

const context = (date: string): LiturgicalCelebrationContext => editorialContext(date);

const KING = context("2026-11-22");
const ADVENT = context("2026-11-29");
const CELEBRATION = { date: KING.date, celebrationId: KING.celebrationId, title: KING.title };

function liturgy(fields: Partial<PublicSongClassification>): PublicSongClassification {
  const { editorialRationale, ...rest } = EMPTY_CLASSIFICATION_INPUT;
  void editorialRationale;
  return { ...rest, ...fields };
}

const PASTOR: SuggestionCandidate = {
  id: "cat-pastor",
  title: "Pastor que Reina",
  artist: "Grupo Imaginário",
  originalKey: "A",
  contentType: "original",
  hasChordPro: true,
  liturgy: liturgy({
    moments: ["comunhao"],
    celebrations: ["cristo-rei"],
    themes: ["bom-pastor"],
    scripture: [{ book: "sl", chapter: 23 }],
  }),
};

const MESA: SuggestionCandidate = {
  id: "cat-mesa",
  title: "Mesa do Caminho",
  artist: "Banda Imaginária",
  originalKey: "C",
  contentType: "original",
  hasChordPro: true,
  liturgy: liturgy({ moments: ["comunhao"], officialReference: "Documento oficial de exemplo" }),
};

const ENTRADA: SuggestionCandidate = {
  id: "cat-entrada",
  title: "Portas Abertas da Manhã",
  artist: "Coral Fictício",
  originalKey: "D",
  contentType: "original",
  hasChordPro: true,
  liturgy: liturgy({ moments: ["entrada", "gloria"] }),
};

const CANDIDATES = [PASTOR, MESA, ENTRADA];

/** O que a leitura pública do catálogo devolve para cada música. */
const CATALOG: CatalogSongView[] = CANDIDATES.map(({ id, title, artist, originalKey }) => ({
  id,
  title,
  artist,
  originalKey: originalKey ?? "C",
  contentType: "original",
  chordPro: "[C]Letra",
  chordProAvailable: true,
}));

function renderPlanner(options: { repertoireId?: string | null; moment?: LiturgicalMomentId | null; context?: LiturgicalCelebrationContext } = {}) {
  const celebration = options.context ?? KING;
  return render(
    <MassPlanner
      celebration={{ date: celebration.date, celebrationId: celebration.celebrationId, title: celebration.title }}
      moments={suggestForCelebration(celebration, CANDIDATES, options.moment ? { moments: [options.moment] } : {})}
      activeMoment={options.moment ?? null}
      repertoireId={options.repertoireId ?? null}
    />,
  );
}

/** Momentos em abas (Etapa 2E.4A): escolhe a aba e devolve o painel dela. */
function openMoment(name: string): HTMLElement {
  fireEvent.click(screen.getByRole("tab", { name }));
  return screen.getByRole("tabpanel", { name });
}

function lastToast(): string | undefined {
  return toastStore.getSnapshot().at(-1)?.message;
}

function writes(): (string | undefined)[] {
  return fakeAccount.fetch.mock.calls
    .map(([, init]) => init?.method)
    .filter((method) => method !== undefined && method !== "GET");
}

function massRepertoires() {
  return fakeAccount.library().repertoires.filter((repertoire) => repertoire.mass);
}

beforeEach(async () => {
  router.replace.mockClear();
  await openAccount({ songs: [], repertoires: [] });
  fakeAccount.setCatalog(CATALOG);
});

describe("sugestões por momento", () => {
  it("mostra a justificativa de cada sugestão, a partir da classificação", () => {
    renderPlanner();
    openMoment("Comunhão");

    const reasons = screen.getByRole("list", { name: "Por que Pastor que Reina foi sugerida" });
    expect(within(reasons).getAllByRole("listitem").map((entry) => entry.textContent)).toEqual([
      "Adequada à Comunhão",
      "Associada à celebração: Cristo Rei",
      "Relacionada ao salmo responsorial (Sl 22(23),1-2a.2b-3.5-6)",
      "Relacionada ao tema: bom pastor",
    ]);
  });

  it("distingue a sugestão do Repertório Santa Cecília da indicação com fonte oficial", () => {
    renderPlanner();
    const communion = openMoment("Comunhão");

    expect(within(communion).getAllByText(/^Sugestão do Repertório Santa Cecília · classificação/).length).toBeGreaterThan(0);
    expect(
      within(communion).getByText(/^Indicação fundamentada em fonte oficial: Documento oficial de exemplo · /),
    ).toBeDefined();
    expect(screen.getByText(/Não representam aprovação oficial da Igreja/)).toBeDefined();
  });

  it("a celebração e o tema ordenam antes do título", () => {
    renderPlanner();
    const titles = within(openMoment("Comunhão"))
      .getAllByRole("link", { name: /^Abrir a cifra de/ })
      .map((link) => link.getAttribute("aria-label"));
    expect(titles).toEqual(["Abrir a cifra de Pastor que Reina", "Abrir a cifra de Mesa do Caminho"]);
  });

  it("abre a cifra guardando o caminho de volta para a celebração", () => {
    renderPlanner();
    openMoment("Comunhão");
    expect(screen.getByRole("link", { name: "Abrir a cifra de Pastor que Reina" }).getAttribute("href")).toBe(
      "/catalogo/cat-pastor?missa=2026-11-22",
    );
  });

  it("momento sem músicas oferece a busca manual, sem inventar sugestões", () => {
    renderPlanner();
    const offertory = openMoment("Preparação das oferendas");

    expect(within(offertory).getByText(/Nenhuma sugestão no catálogo para este momento/)).toBeDefined();
    expect(within(offertory).getByRole("link", { name: "Buscar no catálogo" }).getAttribute("href")).toBe(
      "/catalogo?momento=preparacao-das-oferendas",
    );
  });

  it("no Advento, o Glória aparece como omitido e nada é sugerido para ele", () => {
    renderPlanner({ context: ADVENT });
    const gloria = openMoment("Glória");

    expect(within(gloria).getByText(/O Glória não é cantado nos domingos do Advento e da Quaresma/)).toBeDefined();
    expect(within(gloria).getByText("Não há canto para este momento nesta celebração.")).toBeDefined();
    expect(within(gloria).queryByRole("button")).toBeNull();
    // A mesma música continua sugerida para a entrada.
    expect(within(openMoment("Entrada")).getByText("Portas Abertas da Manhã")).toBeDefined();
  });

  it("o filtro por momento mantém a data e o repertório no endereço", () => {
    router.push.mockClear();
    renderPlanner({ repertoireId: "rep-1", moment: "comunhao" });
    const tabs = screen.getByRole("tablist", { name: "Momentos da missa" });

    expect(within(tabs).getByRole("tab", { name: "Comunhão" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel", { name: "Comunhão" })).toBeDefined();
    expect(screen.queryByRole("tabpanel", { name: "Entrada" })).toBeNull();
    // A lista completa traz só este momento: os outros são buscados com o mesmo endereço.
    fireEvent.click(within(tabs).getByRole("tab", { name: "Entrada" }));
    expect(router.push).toHaveBeenCalledWith("/preparar-missa?data=2026-11-22&momento=entrada&repertorio=rep-1", { scroll: false });
    expect(screen.getByRole("link", { name: "Ver todos os momentos" }).getAttribute("href")).toBe(
      "/preparar-missa?data=2026-11-22&repertorio=rep-1",
    );
  });

  it("as abas seguem o padrão de teclado: setas, Home e End", () => {
    renderPlanner();
    const entry = screen.getByRole("tab", { name: "Entrada" });
    expect(entry.getAttribute("aria-selected")).toBe("true");
    expect(entry.getAttribute("tabindex")).toBe("0");

    fireEvent.keyDown(entry, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Ato penitencial" }).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Ato penitencial" }));
    fireEvent.keyDown(document.activeElement as Element, { key: "End" });
    expect(screen.getByRole("tab", { name: "Encerramento" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(document.activeElement as Element, { key: "Home" });
    expect(screen.getByRole("tabpanel", { name: "Entrada" })).toBeDefined();
  });

  it("catálogo fora do ar não é mostrado como falta de sugestões", () => {
    render(<MassPlanner celebration={CELEBRATION} moments={null} activeMoment={null} repertoireId={null} />);
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível consultar o catálogo agora");
    expect(screen.queryByText(/Nenhuma sugestão/)).toBeNull();
  });
});

describe("repertório da missa", () => {
  it("visitante consulta tudo, mas é convidado a entrar para montar o repertório", async () => {
    cleanup();
    await openSignedOut();
    const before = writes().length;
    renderPlanner();
    openMoment("Comunhão");

    fireEvent.click(screen.getByRole("button", { name: "Adicionar Pastor que Reina ao repertório (Comunhão)" }));

    const panel = screen.getByRole("region", { name: "Repertório desta missa" });
    expect(await within(panel).findByRole("link", { name: "Entrar" })).toBeDefined();
    expect(within(panel).getByText("Entre na sua conta para montar o repertório desta missa.")).toBeDefined();
    expect(writes().length).toBe(before);
    expect(Object.keys(localStorage).filter((key) => key.includes("repertorio.biblioteca"))).toEqual([]);
  });

  it("sem repertório escolhido, a música não é adicionada em silêncio", async () => {
    renderPlanner();
    openMoment("Comunhão");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Pastor que Reina ao repertório (Comunhão)" }));

    expect(await screen.findByText("Crie ou escolha o repertório desta missa para adicionar músicas.")).toBeDefined();
    expect(fakeAccount.library().repertoires).toEqual([]);
  });

  it("cria o repertório a partir da celebração, adiciona a sugestão com o momento e ajusta o tom", async () => {
    const view = renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: /Montar o repertório desta missa/ }));
    const name = (await screen.findByLabelText("Nome do repertório")) as HTMLInputElement;
    expect(name.value).toBe("Missa — Nosso Senhor Jesus Cristo, Rei do Universo");
    fireEvent.click(screen.getByRole("button", { name: "Criar repertório" }));

    await waitFor(() => expect(massRepertoires()).toHaveLength(1));
    const [created] = massRepertoires();
    expect(created.mass).toEqual({
      date: "2026-11-22",
      celebrationId: "2026-11-22-cristo-rei",
      title: "Nosso Senhor Jesus Cristo, Rei do Universo",
    });
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(`/preparar-missa?data=2026-11-22&repertorio=${created.id}`, { scroll: false }),
    );

    // O endereço passa a apontar para o repertório em construção.
    view.unmount();
    renderPlanner({ repertoireId: created.id });
    openMoment("Comunhão");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Pastor que Reina ao repertório (Comunhão)" }));
    await waitFor(() => expect(lastToast()).toBe("“Pastor que Reina” adicionada: Comunhão."));
    openMoment("Entrada");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Portas Abertas da Manhã ao repertório (Entrada)" }));
    await waitFor(() => expect(massRepertoires()[0].items).toHaveLength(2));

    // A entrada vem antes da comunhão, mesmo adicionada depois; só a referência é gravada.
    expect(massRepertoires()[0].items.map((item) => [item.songId, item.source, item.moment])).toEqual([
      ["cat-entrada", "catalog", "entrada"],
      ["cat-pastor", "catalog", "comunhao"],
    ]);
    expect(JSON.stringify(fakeAccount.library())).not.toContain("[C]Letra");
    openMoment("Comunhão");
    expect(await screen.findByRole("button", { name: "Pastor que Reina já está no repertório" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Repertório em construção/ }));
    const panel = screen.getByRole("region", { name: "Repertório desta missa" });
    const rows = within(panel).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("1. Portas Abertas da ManhãEntrada"),
      expect.stringContaining("2. Pastor que ReinaComunhão"),
    ]);

    fireEvent.click(within(panel).getByRole("button", { name: "Aumentar um semitom de Pastor que Reina" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Aumentar um semitom de Pastor que Reina" }));
    await waitFor(() =>
      expect(massRepertoires()[0].items.find((item) => item.songId === "cat-pastor")?.transposeSemitones).toBe(2),
    );
    expect(massRepertoires()[0].items.find((item) => item.songId === "cat-entrada")?.transposeSemitones).toBe(0);
    expect(within(panel).getByRole("link", { name: "Ver repertório completo" }).getAttribute("href")).toBe(
      `/repertorios/${created.id}`,
    );
  });

  it("não substitui um repertório já existente para a data: oferece continuar ou criar outro", async () => {
    const existing = await fakeAccount.otherDevice().repertoires.create({
      name: "Missa das 10h",
      description: "",
      mass: { date: "2026-11-22", title: "Cristo Rei" },
    });
    await openAccount(fakeAccount.library());
    fakeAccount.setCatalog(CATALOG);
    renderPlanner();

    fireEvent.click(screen.getByRole("button", { name: /Montar o repertório desta missa/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar em “Missa das 10h”" }));

    expect(router.replace).toHaveBeenCalledWith(`/preparar-missa?data=2026-11-22&repertorio=${existing.id}`, { scroll: false });
    expect(screen.getByLabelText("Ou crie outro repertório")).toBeDefined();
    expect(fakeAccount.library().repertoires).toHaveLength(1);
    expect(writes().filter((method) => method === "PUT" || method === "DELETE")).toEqual([]);
  });

  it("um repertório antigo, sem missa, não é oferecido nem convertido", async () => {
    await fakeAccount.otherDevice().repertoires.create({ name: "Ensaio de quinta", description: "" });
    await openAccount(fakeAccount.library());
    renderPlanner();

    fireEvent.click(screen.getByRole("button", { name: /Montar o repertório desta missa/ }));
    await screen.findByLabelText("Nome do repertório");

    expect(screen.queryByRole("button", { name: /Continuar em/ })).toBeNull();
    expect(fakeAccount.library().repertoires[0]).not.toHaveProperty("mass");
  });
});

describe("contexto da celebração", () => {
  it("mostra título, tempo, cor, leituras e a origem dos dados", () => {
    render(<CelebrationCard context={KING} />);

    expect(screen.getByRole("heading", { level: 2, name: "Nosso Senhor Jesus Cristo, Rei do Universo" })).toBeDefined();
    expect(screen.getByText("Solenidade")).toBeDefined();
    expect(screen.getByText("Tempo Comum")).toBeDefined();
    expect(screen.getByText("Branco")).toBeDefined();
    expect(screen.getByText("(confirmada em fonte)")).toBeDefined();
    expect(screen.getByText("Mt 25,31-46")).toBeDefined();
    expect(screen.getByText("Sl 22(23),1-2a.2b-3.5-6")).toBeDefined();
    expect(screen.getByText(/leitura editorial do Repertório Santa Cecília/)).toBeDefined();
    expect(screen.getByRole("link", { name: /Canção Nova/ }).getAttribute("href")).toContain("liturgia.cancaonova.com");
    expect(screen.getByText(/não é um calendário completo nem uma publicação oficial/)).toBeDefined();
  });

  it("uma leitura não conferida é informada, com link para a fonte, sem ser inventada", () => {
    render(<CelebrationCard context={context("2026-12-20")} />);

    expect(screen.getByText(/Não conferido nesta base/)).toBeDefined();
    expect(screen.getByRole("link", { name: /Consultar a liturgia do dia/ }).getAttribute("href")).toBe(
      "https://www.vaticannews.va/pt/palavra-do-dia/2026/12/20.html",
    );
    expect(screen.getByText("(pela regra geral da Instrução Geral do Missal Romano (n. 346), sem confirmação em fonte desta data)")).toBeDefined();
  });
});

describe("ausência de sugestões explicada", () => {
  function renderWith(candidates: SuggestionCandidate[], catalog: { published: number; classified: number; classifiedForMass: number }) {
    const moments = suggestForCelebration(KING, candidates).map((entry) => ({
      ...entry,
      classifiedForMoment: candidates.filter((candidate) => candidate.liturgy.moments.includes(entry.moment)).length,
    }));
    return render(
      <MassPlanner celebration={CELEBRATION} moments={moments} catalog={catalog} activeMoment={null} repertoireId={null} />,
    );
  }

  it("catálogo sem músicas publicadas", () => {
    renderWith([], { published: 0, classified: 0, classifiedForMass: 0 });
    expect(screen.getByRole("status").textContent).toContain("O catálogo ainda não tem músicas publicadas");
  });

  it("músicas publicadas, mas nenhuma classificada para a missa", () => {
    renderWith([], { published: 12, classified: 0, classifiedForMass: 0 });
    expect(screen.getByRole("status").textContent).toContain("Nenhuma música publicada do catálogo foi classificada para a missa");
  });

  it("momento sem nenhuma música classificada é diferente de momento sem música adequada", () => {
    const lent = { ...MESA, liturgy: liturgy({ moments: ["comunhao"], seasons: ["quaresma"] }) };
    renderWith([lent], { published: 5, classified: 1, classifiedForMass: 1 });

    const communion = openMoment("Comunhão");
    expect(communion.textContent).toContain("Há 1 música classificada para este momento, mas nenhuma é indicada para esta celebração");
    const entrance = openMoment("Entrada");
    expect(entrance.textContent).toContain("Nenhuma música do catálogo foi classificada para este momento ainda.");
    expect(within(entrance).getByRole("link", { name: "Buscar no catálogo" }).getAttribute("href")).toBe("/catalogo?momento=entrada");
  });

  it("cada sugestão informa se a classificação foi conferida e se há cifra", () => {
    const reviewed = { ...PASTOR, liturgy: { ...PASTOR.liturgy, reviewStatus: "reviewed" as const } };
    const metadataOnly = { ...MESA, hasChordPro: false, contentType: "metadata-only" as const, originalKey: undefined };
    renderWith([reviewed, metadataOnly], { published: 2, classified: 2, classifiedForMass: 2 });

    const communion = openMoment("Comunhão");
    expect(within(communion).getByText(/classificação conferida pela equipe/)).toBeDefined();
    expect(within(communion).getByText(/classificação ainda não conferida · cifra ainda não disponível/)).toBeDefined();
    expect(within(communion).getByRole("link", { name: "Abrir a cifra de Mesa do Caminho" }).textContent).toBe("Abrir música");
  });
});

