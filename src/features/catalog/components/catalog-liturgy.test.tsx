import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogSongView } from "@/features/library/domain/library";
import type { SongClassification } from "@/features/liturgy/domain/classification";

import { createCatalogAdminApi } from "../data/catalog-admin-api";
import type { CatalogSearchResult, CatalogSong } from "../domain/catalog-song";
import { catalogSearchSchema, toCatalogSongView } from "../domain/catalog-song";
import { CatalogClassificationEditor, CatalogReviewPanel } from "./catalog-classification-editor";
import { CatalogResults, CatalogSearchForm } from "./catalog-results";
import { CatalogSongScreen } from "./catalog-song-screen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

const LITURGY: SongClassification = {
  category: "liturgical",
  moments: ["comunhao", "acao-de-gracas"],
  seasons: ["quaresma"],
  celebrations: ["sagrado-coracao"],
  themes: ["misericordia", "eucaristia"],
  scripture: [{ book: "jo", chapter: 6, verseStart: 51, verseEnd: 58 }],
  avoidSeasons: ["pascoa"],
  suitabilityNotes: "Para a procissão da comunhão.",
  editorialRationale: "JUSTIFICATIVA INTERNA",
  officialReference: "",
  guidanceSource: "Subsídio fictício",
  classifiedBy: "admin-1",
  classifiedAt: "2026-11-11T12:00:00.000Z",
  reviewStatus: "pending_review",
  review: null,
  dispute: null,
};

const song: CatalogSong = {
  id: "cat-1",
  title: "Mesa do Caminho",
  artist: "Banda Imaginária",
  originalKey: "C",
  contentType: "original",
  chordPro: "[C]Letra",
  status: "published",
  rights: {
    basis: "original-work",
    evidence: "EVIDENCIA INTERNA",
    displayChordPro: true,
    shareChordPro: false,
    linkExternalSource: true,
    approvedBy: "admin-1",
    approvedAt: "2026-11-01T00:00:00.000Z",
  },
  revision: 5,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  publishedAt: "2026-11-01T00:00:00.000Z",
  liturgy: null,
  metadataSources: [],
};

describe("filtros do catálogo", () => {
  it("valida cada filtro contra o seu vocabulário", () => {
    expect(catalogSearchSchema.parse({ moment: "comunhao", season: "quaresma", theme: "misericordia" })).toMatchObject({
      moment: "comunhao",
      season: "quaresma",
      theme: "misericordia",
      q: "",
      page: 1,
    });
    expect(catalogSearchSchema.safeParse({ moment: "intervalo" }).success).toBe(false);
    expect(catalogSearchSchema.safeParse({ season: { $ne: null } }).success).toBe(false);
    expect(catalogSearchSchema.safeParse({ celebration: "festa-junina" }).success).toBe(false);
    expect(catalogSearchSchema.safeParse({ theme: "" }).success).toBe(false);
  });

  it("o formulário oferece busca e os quatro filtros, com os valores atuais", () => {
    render(<CatalogSearchForm query="mesa" filters={{ moment: "comunhao", season: "quaresma" }} />);

    expect((screen.getByLabelText("Buscar no catálogo por título ou artista") as HTMLInputElement).value).toBe("mesa");
    expect((screen.getByLabelText("Momento da missa") as HTMLSelectElement).value).toBe("comunhao");
    expect((screen.getByLabelText("Tempo litúrgico") as HTMLSelectElement).value).toBe("quaresma");
    expect((screen.getByLabelText("Celebração") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Tema") as HTMLSelectElement).name).toBe("tema");
    expect(within(screen.getByLabelText("Momento da missa")).getAllByRole("option")).toHaveLength(12);
  });

  const result: CatalogSearchResult = {
    songs: [
      {
        id: "a",
        title: "Mesa do Caminho",
        artist: "X",
        originalKey: "C",
        contentType: "original",
        hasChordPro: true,
        moments: ["comunhao", "acao-de-gracas"],
        seasons: ["quaresma"],
      },
    ],
    page: 2,
    pageSize: 1,
    total: 3,
    totalPages: 3,
  };

  it("mostra a contagem com os filtros combinados e os mantém na paginação", () => {
    render(
      <CatalogResults
        query=""
        filters={{ moment: "comunhao", season: "quaresma", theme: "misericordia" }}
        result={result}
      />,
    );

    expect(screen.getByText(/3 músicas · Comunhão · Quaresma · Misericórdia/)).toBeDefined();
    const first = screen.getAllByRole("listitem")[0];
    expect(within(first).getByText("Comunhão")).toBeDefined();
    expect(within(first).getByText("Ação de graças")).toBeDefined();
    expect(screen.getByRole("link", { name: /Próxima/ }).getAttribute("href")).toBe(
      "/catalogo?momento=comunhao&tempo=quaresma&tema=misericordia&page=3",
    );
    expect(screen.getByRole("link", { name: /Anterior/ }).getAttribute("href")).toBe(
      "/catalogo?momento=comunhao&tempo=quaresma&tema=misericordia",
    );
    expect(screen.getByRole("link", { name: "Limpar filtros" }).getAttribute("href")).toBe("/catalogo");
  });

  it("estado vazio explica a combinação de filtros e oferece limpar", () => {
    render(
      <CatalogResults
        query="mesa"
        filters={{ celebration: "pentecostes", moment: "entrada" }}
        result={{ songs: [], page: 1, pageSize: 12, total: 0, totalPages: 0 }}
      />,
    );

    expect(screen.getByText("Nenhuma música encontrada")).toBeDefined();
    expect(screen.getByText(/combina “mesa” com Entrada, Pentecostes/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Limpar busca e filtros" }).getAttribute("href")).toBe("/catalogo");
  });

  it("sem filtros nem busca, o vazio é do próprio catálogo", () => {
    render(<CatalogResults query="" result={{ songs: [], page: 1, pageSize: 12, total: 0, totalPages: 0 }} />);
    expect(screen.getByText("O catálogo ainda está vazio")).toBeDefined();
    expect(screen.queryByRole("link", { name: /Limpar/ })).toBeNull();
  });
});

describe("classificação na leitura pública", () => {
  it("a projeção pública leva a classificação, sem justificativa, evidência ou autoria", () => {
    const view = toCatalogSongView({ ...song, liturgy: LITURGY });
    const text = JSON.stringify(view);

    expect(view.liturgy).toMatchObject({ moments: ["comunhao", "acao-de-gracas"], themes: ["misericordia", "eucaristia"] });
    expect(text).not.toContain("JUSTIFICATIVA INTERNA");
    expect(text).not.toContain("EVIDENCIA INTERNA");
    expect(text).not.toContain("classifiedBy");
    expect(toCatalogSongView(song)).not.toHaveProperty("liturgy");
  });

  it("mostra momentos, tempos, temas e referências, como orientação editorial", () => {
    render(<CatalogSongScreen song={toCatalogSongView({ ...song, liturgy: LITURGY }) as CatalogSongView} />);
    const section = screen.getByRole("region", { name: "Uso litúrgico" });

    expect(within(section).getByText("Canto litúrgico.")).toBeDefined();
    expect(within(section).getByText("Comunhão · Ação de graças")).toBeDefined();
    expect(within(section).getByText("Quaresma")).toBeDefined();
    expect(within(section).getByText("Sagrado Coração de Jesus")).toBeDefined();
    expect(within(section).getByText("Misericórdia · Eucaristia")).toBeDefined();
    expect(within(section).getByText("Jo 6,51-58")).toBeDefined();
    expect(within(section).getByText("Páscoa")).toBeDefined();
    expect(within(section).getByText("Para a procissão da comunhão.")).toBeDefined();
    expect(within(section).getByText(/Não representa aprovação oficial da Igreja/)).toBeDefined();
    expect(section.textContent).not.toContain("JUSTIFICATIVA INTERNA");
    // A observação fica nos detalhes recolhidos, sem ocupar o painel de leitura.
    expect(screen.getAllByText("Para a procissão da comunhão.")).toHaveLength(1);
    expect(section.closest("details")).not.toBeNull();
    expect(section.closest("details")?.open).toBe(false);
  });

  it("canto devocional é identificado como fora das sugestões para a missa", () => {
    const devotional = toCatalogSongView({
      ...song,
      liturgy: { ...LITURGY, category: "devotional", moments: [], seasons: [], avoidSeasons: [] },
    });
    render(<CatalogSongScreen song={devotional} />);

    expect(screen.getByText("Canto devocional.")).toBeDefined();
    expect(screen.getByText("Esta música não aparece nas sugestões para a missa.")).toBeDefined();
  });

  it("sem classificação, a seção não aparece; o caminho de volta pode ser a celebração", () => {
    render(
      <CatalogSongScreen
        song={toCatalogSongView(song)}
        back={{ href: "/preparar-missa?data=2026-11-22", label: "Preparar missa" }}
      />,
    );

    expect(screen.queryByRole("region", { name: "Uso litúrgico" })).toBeNull();
    expect(screen.getByRole("link", { name: "Preparar missa" }).getAttribute("href")).toBe("/preparar-missa?data=2026-11-22");
  });
});

describe("editor de classificação da administração", () => {
  const calls: { url: string; method: string; ifMatch: string | null; body: unknown }[] = [];
  let respond: () => Response;

  beforeEach(() => {
    calls.length = 0;
    respond = () => new Response(JSON.stringify({ song: { ...song, revision: 6, liturgy: LITURGY } }), { status: 200 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({
          url,
          method: init.method ?? "GET",
          ifMatch: new Headers(init.headers).get("if-match"),
          body: init.body ? JSON.parse(String(init.body)) : undefined,
        });
        return respond();
      }),
    );
  });

  function renderEditor(current: CatalogSong = song) {
    const onSaved = vi.fn();
    render(<CatalogClassificationEditor api={createCatalogAdminApi("admin-1")} song={current} onSaved={onSaved} />);
    return onSaved;
  }

  // Momentos e tempos são botões de alternância; celebrações e temas, caixas de seleção pesquisáveis.
  const check = (name: string | RegExp, group: string) => {
    const container = within(screen.getByRole("group", { name: new RegExp(`^${group}`) }));
    fireEvent.click(container.queryByRole("checkbox", { name }) ?? container.getByRole("button", { name }));
  };

  it("classifica com seleção múltipla e envia só a classificação, com a revisão carregada", async () => {
    const onSaved = renderEditor();

    check("Comunhão", "Momentos da missa");
    check("Entrada", "Momentos da missa");
    check("Quaresma", "Tempos litúrgicos");
    check("Misericórdia", "Temas");
    check("Perdão", "Temas");
    fireEvent.change(screen.getByLabelText("Livro"), { target: { value: "jl" } });
    fireEvent.change(screen.getByLabelText("Capítulo"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Versículo inicial"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Versículo final"), { target: { value: "13" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar referência" }));
    expect(screen.getByText("Jl 2,12-13")).toBeDefined();
    fireEvent.change(screen.getByLabelText(/Justificativa editorial/), { target: { value: "Texto penitencial." } });
    fireEvent.change(screen.getByLabelText(/Fonte de orientação/), { target: { value: "CNBB, subsídio de Quaresma" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar classificação" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: "/api/v1/admin/catalog/songs/cat-1/classification",
      method: "PUT",
      ifMatch: '"5"',
    });
    expect(calls[0].body).toEqual({
      liturgy: {
        category: "liturgical",
        moments: ["comunhao", "entrada"],
        seasons: ["quaresma"],
        celebrations: [],
        themes: ["misericordia", "perdao"],
        scripture: [{ book: "jl", chapter: 2, verseStart: 12, verseEnd: 13 }],
        avoidSeasons: [],
        suitabilityNotes: "",
        editorialRationale: "Texto penitencial.",
        officialReference: "",
        guidanceSource: "CNBB, subsídio de Quaresma",
      },
    });
    // Direitos e dados musicais não fazem parte do pedido.
    expect(JSON.stringify(calls[0].body)).not.toContain("rights");
    expect(JSON.stringify(calls[0].body)).not.toContain("chordPro");
    expect(onSaved.mock.calls[0][0]).toMatchObject({ revision: 6 });
  });

  it("valida antes de enviar, com as mesmas regras do servidor", () => {
    renderEditor();
    check("Quaresma", "Tempos litúrgicos");
    check("Quaresma", "Não sugerir nestes tempos");
    fireEvent.click(screen.getByRole("button", { name: "Salvar classificação" }));
    expect(screen.getByRole("alert").textContent).toContain("O mesmo tempo não pode ser indicado e restrito.");
    expect(calls).toEqual([]);
  });

  it("salva classificação incompleta como rascunho e mostra o que falta", async () => {
    const onSaved = renderEditor();
    expect(screen.getByText(/para ficar completa falta: momento da missa, justificativa editorial, fonte de orientação/)).toBeDefined();

    check("Comunhão", "Momentos da missa");
    expect(screen.getByText(/para ficar completa falta: justificativa editorial, fonte de orientação/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Salvar classificação" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls[0].body).toMatchObject({ liturgy: { moments: ["comunhao"], editorialRationale: "", guidanceSource: "" } });
  });

  it("canto devocional não pode receber momentos da missa", () => {
    renderEditor();
    check("Comunhão", "Momentos da missa");
    fireEvent.change(screen.getByLabelText(/Tipo de uso/), { target: { value: "devotional" } });

    const moments = screen.getByRole("group", { name: /^Momentos da missa/ }) as HTMLFieldSetElement;
    expect(moments.disabled).toBe(true);
    expect(within(moments).getByRole("button", { name: "Comunhão" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("pesquisa nas listas longas sem esconder o que já foi marcado", () => {
    renderEditor();
    check("Cristo Rei", "Celebrações");
    fireEvent.change(screen.getByLabelText("Pesquisar em Celebrações"), { target: { value: "coracao" } });

    const group = screen.getByRole("group", { name: /^Celebrações/ });
    expect(within(group).getAllByRole("checkbox").map((box) => box.parentElement?.textContent)).toEqual([
      "Sagrado Coração de Jesus",
      "Cristo Rei",
    ]);
  });

  it("recusa referência bíblica inválida ou repetida", () => {
    renderEditor({ ...song, liturgy: LITURGY });

    fireEvent.click(screen.getByRole("button", { name: "Adicionar referência" }));
    expect(screen.getByText("Informe o capítulo.")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Livro"), { target: { value: "jo" } });
    fireEvent.change(screen.getByLabelText("Capítulo"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Versículo inicial"), { target: { value: "51" } });
    fireEvent.change(screen.getByLabelText("Versículo final"), { target: { value: "58" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar referência" }));
    expect(screen.getByText("Esta referência já foi adicionada.")).toBeDefined();
  });

  it("revisão desatualizada: avisa e não sobrescreve", async () => {
    respond = () =>
      new Response(JSON.stringify({ error: { code: "precondition_failed", message: "Alterada." } }), { status: 412 });
    const onSaved = renderEditor({ ...song, liturgy: LITURGY });

    fireEvent.click(screen.getByRole("button", { name: "Salvar classificação" }));

    expect(await screen.findByText(/alterada por outra pessoa da administração/)).toBeDefined();
    expect(onSaved).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/Justificativa editorial/) as HTMLTextAreaElement).value).toBe("JUSTIFICATIVA INTERNA");
  });

  it("remover a classificação envia nulo, com a revisão", async () => {
    respond = () => new Response(JSON.stringify({ song: { ...song, revision: 6 } }), { status: 200 });
    const onSaved = renderEditor({ ...song, liturgy: LITURGY });

    fireEvent.click(screen.getByRole("button", { name: "Remover classificação" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls[0]).toMatchObject({ method: "PUT", ifMatch: '"5"', body: { liturgy: null } });
  });
});

describe("revisão humana da classificação", () => {
  const calls: { url: string; method: string; ifMatch: string | null; body: unknown }[] = [];
  let respond: () => Response;

  beforeEach(() => {
    calls.length = 0;
    respond = () =>
      new Response(
        JSON.stringify({
          song: {
            ...song,
            revision: 6,
            liturgy: { ...LITURGY, reviewStatus: "reviewed", review: { by: "admin-2", at: "2026-11-14T00:00:00.000Z", source: "Hinário" } },
          },
        }),
        { status: 200 },
      );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({
          url,
          method: init.method ?? "GET",
          ifMatch: new Headers(init.headers).get("if-match"),
          body: init.body ? JSON.parse(String(init.body)) : undefined,
        });
        return respond();
      }),
    );
  });

  function renderPanel(current: CatalogSong) {
    const onSaved = vi.fn();
    render(<CatalogReviewPanel api={createCatalogAdminApi("admin-1")} song={current} onSaved={onSaved} />);
    return onSaved;
  }

  const actions = () =>
    within(screen.getByLabelText("Ação"))
      .getAllByRole("option")
      .map((option) => option.textContent);

  it("sem classificação, pede a classificação antes", () => {
    renderPanel(song);
    expect(screen.getByText(/Classifique a música \(etapa C\)/)).toBeDefined();
  });

  it("classificação incompleta não pode ser conferida", () => {
    renderPanel({ ...song, liturgy: { ...LITURGY, guidanceSource: "" } });
    expect(actions()).toEqual(["Escolha uma ação", "Registrar divergência"]);
    expect(screen.getByText("Para conferir, complete antes: fonte de orientação.")).toBeDefined();
  });

  it("conferir exige a confirmação pessoal e envia a fonte, com a revisão carregada", async () => {
    const onSaved = renderPanel({ ...song, liturgy: LITURGY });

    fireEvent.change(screen.getByLabelText("Ação"), { target: { value: "approve" } });
    expect((screen.getByLabelText("Fonte consultada na conferência") as HTMLInputElement).value).toBe("Subsídio fictício");
    fireEvent.click(screen.getByRole("button", { name: "Marcar como conferida" }));
    expect(screen.getByRole("alert").textContent).toContain("Confirme que você conferiu a classificação.");
    expect(calls).toEqual([]);

    fireEvent.change(screen.getByLabelText("Fonte consultada na conferência"), { target: { value: "Hinário" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Conferi pessoalmente/ }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar como conferida" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls[0]).toMatchObject({
      url: "/api/v1/admin/catalog/songs/cat-1/classification/review",
      method: "POST",
      ifMatch: '"5"',
      body: { action: "approve", humanReviewConfirmed: true, source: "Hinário" },
    });
  });

  it("divergência registrada: só resta resolver, com nota", async () => {
    renderPanel({
      ...song,
      liturgy: { ...LITURGY, reviewStatus: "disputed", dispute: { note: "Momento discutível.", by: "admin-2", at: "2026-11-14T00:00:00.000Z" } },
    });
    expect(screen.getByText("Momento discutível.")).toBeDefined();
    expect(actions()).toEqual(["Escolha uma ação", "Resolver a divergência"]);

    fireEvent.change(screen.getByLabelText("Ação"), { target: { value: "resolve" } });
    fireEvent.click(screen.getByRole("button", { name: "Resolver a divergência" }));
    expect(screen.getByRole("alert").textContent).toContain("Registre como a divergência foi resolvida.");
    expect(calls).toEqual([]);
  });
});

