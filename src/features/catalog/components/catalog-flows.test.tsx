import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogSongView } from "@/features/library/domain/library";
import { RepertoireDetailScreen } from "@/features/repertoires/components/repertoire-detail-screen";
import { SongDetailScreen } from "@/features/songs/components/song-detail-screen";
import { toastStore } from "@/lib/utils/toast";
import { accountLibrary } from "@/features/library/data/browser-library";
import { fakeAccount } from "@/test/fake-account-api";
import { openAccount, openSignedOut } from "@/test/open-account";

import type { CatalogSearchResult } from "../domain/catalog-song";
import { CatalogExplore, CatalogResults } from "./catalog-results";
import { CatalogSongScreen } from "./catalog-song-screen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

const ENSAIO = "rep-ensaio-acustico";

const ESTRADA: CatalogSongView = {
  id: "cat-estrada",
  title: "Estrada do Catálogo",
  artist: "Banda Imaginária",
  originalKey: "G",
  contentType: "original",
  chordPro: "[G]Vou pela [D]estrada",
  chordProAvailable: true,
};

const SEM_CIFRA: CatalogSongView = {
  id: "cat-sem-cifra",
  title: "Só Metadados",
  artist: "Grupo Fictício",
  originalKey: "C",
  contentType: "authorized",
  chordProAvailable: false,
};

const METADADOS: CatalogSongView = {
  id: "cat-metadados",
  title: "Canto Só Identificado",
  artist: "",
  contentType: "metadata-only",
  chordProAvailable: false,
  compositionReference: "Hinário fictício, n. 12",
  metadataSources: [{ title: "Fonte fictícia", url: "https://example.com/fonte", accessedAt: "2026-11-14" }],
  liturgy: {
    category: "liturgical",
    moments: ["comunhao", "acao-de-gracas"],
    seasons: [],
    celebrations: [],
    themes: [],
    scripture: [],
    avoidSeasons: [],
    suitabilityNotes: "",
    officialReference: "",
    guidanceSource: "Orientação fictícia",
    reviewStatus: "pending_review",
  },
};

const EXTERNA: CatalogSongView = {
  id: "cat-externa",
  title: "Lá Fora",
  artist: "Grupo Fictício",
  originalKey: "E",
  contentType: "external-link",
  sourceUrl: "https://example.com/la-fora",
  chordProAvailable: false,
};

function storedItems(repertoireId = ENSAIO) {
  return fakeAccount.library().repertoires.find((repertoire) => repertoire.id === repertoireId)?.items ?? [];
}

function lastToast(): string | undefined {
  return toastStore.getSnapshot().at(-1)?.message;
}

beforeEach(async () => {
  await openAccount();
  fakeAccount.setCatalog([ESTRADA, SEM_CIFRA, EXTERNA, METADADOS]);
});

describe("adicionar a partir do repertório", () => {
  it("o catálogo é a origem padrão e grava só a referência", async () => {
    render(<RepertoireDetailScreen repertoireId={ENSAIO} />);
    await screen.findByRole("heading", { level: 1, name: "Ensaio Acústico" });

    let unresolved = 0;
    const stop = accountLibrary.subscribe(() => {
      const snapshot = accountLibrary.getSnapshot();
      if (snapshot.status !== "ready") return;
      const catalogIds = new Set(snapshot.library.catalogSongs.map((song) => song.id));
      const items = snapshot.library.repertoires.flatMap((repertoire) => repertoire.items);
      unresolved += items.filter((item) => item.source === "catalog" && !catalogIds.has(item.songId)).length;
    });
    expect(screen.getByRole("radio", { name: "Catálogo" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.change(screen.getByLabelText("Buscar no catálogo"), { target: { value: "estrada" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar Estrada do Catálogo" }));

    await waitFor(() => expect(lastToast()).toBe("“Estrada do Catálogo” adicionada ao repertório."));
    // Nenhum estado publicado tem o item sem a música resolvida: a tela nunca diz "indisponível".
    expect(unresolved).toBe(0);
    stop();
    const added = storedItems().find((item) => item.songId === ESTRADA.id);
    expect(added).toMatchObject({ source: "catalog", transposeSemitones: 0 });
    expect(JSON.stringify(fakeAccount.library().songs)).not.toContain("Vou pela");
    expect(await screen.findByRole("button", { name: "Estrada do Catálogo já está no repertório" })).toBeDefined();
    expect(await screen.findByRole("link", { name: /Estrada do Catálogo/ })).toBeDefined();
  });

  it("informa quando a busca não encontra nada", async () => {
    render(<RepertoireDetailScreen repertoireId={ENSAIO} />);
    await screen.findByRole("heading", { level: 1, name: "Ensaio Acústico" });

    fireEvent.change(screen.getByLabelText("Buscar no catálogo"), { target: { value: "zzz" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText("Nenhuma música encontrada no catálogo.")).toBeDefined();
  });

  it("uma música despublicada aparece como indisponível, sem perder o item", async () => {
    await fakeAccount.otherDevice().repertoires.addSong(ENSAIO, ESTRADA.id, fakeAccount.library().repertoires.find((r) => r.id === ENSAIO)!.revision, "catalog");
    fakeAccount.setCatalog([]);
    await openAccount(fakeAccount.library());

    render(<RepertoireDetailScreen repertoireId={ENSAIO} />);

    expect(await screen.findByText("Música indisponível no catálogo")).toBeDefined();
    expect(storedItems().some((item) => item.songId === ESTRADA.id && item.source === "catalog")).toBe(true);
  });
});

describe("leitura pública do catálogo", () => {
  it("transpõe só na tela e não altera a música", () => {
    render(<CatalogSongScreen song={ESTRADA} />);

    expect(screen.getByText("Ajuste temporário: a música do catálogo não é alterada.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar um semitom" }));

    expect(screen.getAllByText("G#").length).toBeGreaterThan(0);
    expect(ESTRADA.chordPro).toBe("[G]Vou pela [D]estrada");
    expect(screen.getByRole("button", { name: "Apresentar" })).toBeDefined();
  });

  it("sem direito de exibição, mostra apenas os metadados", () => {
    render(<CatalogSongScreen song={SEM_CIFRA} />);

    expect(screen.getByText("Cifra ainda não disponível")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Apresentar" })).toBeNull();
  });

  it("música só com metadados: sem tom, sem cifra, com fontes e classificação não conferida", () => {
    render(<CatalogSongScreen song={METADADOS} />);

    expect(screen.getByText("Autoria não informada")).toBeDefined();
    expect(screen.getByText(/Hinário fictício, n\. 12/)).toBeDefined();
    expect(screen.queryByText("Tom original")).toBeNull();
    expect(screen.getByText("Cifra ainda não disponível")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Aumentar um semitom" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Apresentar" })).toBeNull();
    const sources = screen.getByRole("region", { name: "Fontes da identificação" });
    expect(within(sources).getByRole("link", { name: "Fonte fictícia" }).getAttribute("href")).toBe("https://example.com/fonte");
    expect(sources.textContent).toContain("Não concedem direito de reprodução");
    const usage = screen.getByRole("region", { name: "Uso litúrgico" });
    expect(usage.textContent).toContain("Fonte de orientação: Orientação fictícia");
    expect(usage.textContent).toContain("Classificação ainda não conferida por uma pessoa da equipe.");
    expect(usage.textContent).toContain("Não representa aprovação oficial da Igreja");
  });

  it("classificação conferida mostra a data e a fonte da conferência", () => {
    const reviewed: CatalogSongView = {
      ...METADADOS,
      liturgy: { ...METADADOS.liturgy!, reviewStatus: "reviewed", review: { at: "2026-11-14T12:00:00.000Z", source: "Hinário" } },
    };
    render(<CatalogSongScreen song={reviewed} />);
    expect(screen.getByRole("region", { name: "Uso litúrgico" }).textContent).toContain(
      "Conferida por uma pessoa da equipe em 14/11/2026 (fonte: Hinário).",
    );
  });

  it("link externo leva à fonte, sem cifra", () => {
    render(<CatalogSongScreen song={EXTERNA} />);

    expect(screen.getByRole("link", { name: /Abrir fonte original/ }).getAttribute("href")).toBe(EXTERNA.sourceUrl);
    expect(screen.queryByText("Tom original")).toBeNull();
  });
});

describe("adicionar a partir do leitor", () => {
  async function openPanel(song = ESTRADA): Promise<void> {
    render(<CatalogSongScreen song={song} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao repertório" }));
    await screen.findByLabelText("Repertório");
  }

  it("escolhe o repertório e o tom deste repertório", async () => {
    await openPanel();

    fireEvent.change(screen.getByLabelText("Repertório"), { target: { value: ENSAIO } });
    fireEvent.change(screen.getByLabelText("Tom neste repertório"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() => expect(lastToast()).toBe("“Estrada do Catálogo” adicionada a Ensaio Acústico."));
    expect(storedItems().find((item) => item.songId === ESTRADA.id)).toMatchObject({
      source: "catalog",
      transposeSemitones: 2,
    });
  });

  it("exige um repertório e recusa duplicidade", async () => {
    await openPanel();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByText("Escolha um repertório.")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Repertório"), { target: { value: ENSAIO } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(storedItems().filter((item) => item.songId === ESTRADA.id)).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao repertório" }));
    fireEvent.change(await screen.findByLabelText("Repertório"), { target: { value: ENSAIO } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText("Esta música já está neste repertório.")).toBeDefined();
    expect(storedItems().filter((item) => item.songId === ESTRADA.id)).toHaveLength(1);
  });

  it("link externo não oferece tom", async () => {
    await openPanel(EXTERNA);
    expect(screen.queryByLabelText("Tom neste repertório")).toBeNull();
  });

  it("música sem tom conhecido entra sem transposição, com o momento escolhido", async () => {
    await openPanel(METADADOS);
    expect(screen.queryByLabelText("Tom neste repertório")).toBeNull();

    const moment = screen.getByLabelText("Momento da missa (opcional)") as HTMLSelectElement;
    const options = Array.from(moment.options).map((option) => option.textContent);
    // Os momentos da classificação vêm primeiro e são identificados como tal.
    expect(options[1]).toBe("Comunhão (indicado na classificação)");
    expect(options[2]).toBe("Ação de graças (indicado na classificação)");

    fireEvent.change(screen.getByLabelText("Repertório"), { target: { value: ENSAIO } });
    fireEvent.change(moment, { target: { value: "comunhao" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() =>
      expect(storedItems().find((item) => item.songId === METADADOS.id)).toMatchObject({
        source: "catalog",
        transposeSemitones: 0,
        moment: "comunhao",
      }),
    );
  });

  it("um visitante é convidado a entrar, sem nada salvo no navegador", async () => {
    await openSignedOut();
    const writes = () => fakeAccount.fetch.mock.calls.filter(([, init]) => init?.method && init.method !== "GET");
    const before = writes().length;

    render(<CatalogSongScreen song={ESTRADA} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao repertório" }));

    expect(await screen.findByRole("link", { name: "Entrar" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Criar conta" })).toBeDefined();
    expect(screen.queryByLabelText("Repertório")).toBeNull();
    expect(writes().length).toBe(before);
  });
});

describe("leitura no contexto do repertório", () => {
  beforeEach(async () => {
    const revision = fakeAccount.library().repertoires.find((r) => r.id === ENSAIO)!.revision;
    await fakeAccount.otherDevice().repertoires.addSong(ENSAIO, ESTRADA.id, revision, "catalog");
    // A conta recarrega e o servidor resolve a música do catálogo usada pelo repertório.
    await accountLibrary.retry();
    await waitFor(() => {
      const snapshot = accountLibrary.getSnapshot();
      expect(snapshot.status === "ready" && snapshot.library.catalogSongs.length).toBe(1);
    });
  });

  function catalogItemId(): string {
    return storedItems().find((item) => item.songId === ESTRADA.id)!.id;
  }

  it("o tom fica no item do repertório; a música do catálogo não muda", async () => {
    render(<RepertoireDetailScreen repertoireId={ENSAIO} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ajustar tom e anotações de Estrada do Catálogo" }));
    fireEvent.click(screen.getByRole("button", { name: "Aumentar um semitom" }));
    fireEvent.click(screen.getByRole("button", { name: "Aumentar um semitom" }));

    await waitFor(() => expect(storedItems().find((item) => item.id === catalogItemId())?.transposeSemitones).toBe(2));
    expect(ESTRADA.originalKey).toBe("G");
  });

  it("abre sem editar nem excluir a música do catálogo", async () => {
    render(
      <SongDetailScreen songId={ESTRADA.id} source="catalog" contextReference={{ repertoireId: ENSAIO, itemId: catalogItemId() }} />,
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Estrada do Catálogo" })).toBeDefined();
    expect(screen.queryByRole("link", { name: /Editar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Excluir/ })).toBeNull();
  });

  it("o contexto de outra origem não é aceito", async () => {
    render(
      <SongDetailScreen songId={ESTRADA.id} source="personal" contextReference={{ repertoireId: ENSAIO, itemId: catalogItemId() }} />,
    );

    expect(await screen.findByText(/não encontrada/i)).toBeDefined();
  });
});

describe("resultados da busca", () => {
  const result: CatalogSearchResult = {
    songs: [
      { id: "a", title: "Com Cifra", artist: "X", originalKey: "G", contentType: "original", hasChordPro: true },
      { id: "b", title: "Sem Cifra", artist: "Y", originalKey: "C", contentType: "authorized", hasChordPro: false },
      { id: "c", title: "Externa", artist: "Z", originalKey: "E", contentType: "external-link", hasChordPro: false },
      { id: "d", title: "Só Metadados", artist: "", contentType: "metadata-only", hasChordPro: false },
    ],
    page: 2,
    pageSize: 4,
    total: 12,
    totalPages: 3,
  };

  it("mostra indicadores, links e paginação com a busca preservada", () => {
    render(<CatalogResults query="ca" result={result} />);

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByText("Cifra disponível")).toBeDefined();
    expect(within(rows[1]).getByText("Cifra ainda não disponível")).toBeDefined();
    expect(within(rows[2]).getByText("Consultar cifra na fonte original")).toBeDefined();
    expect(within(rows[3]).getByText("Cifra ainda não disponível")).toBeDefined();
    expect(within(rows[3]).getByText("Autoria não informada")).toBeDefined();
    // Escolher uma música abre o painel central, mantendo a busca e a página no endereço.
    expect(within(rows[0]).getByRole("link").getAttribute("href")).toBe("/catalogo?q=ca&page=2&musica=a");
    expect(screen.getByRole("link", { name: /Anterior/ }).getAttribute("href")).toBe("/catalogo?q=ca");
    expect(screen.getByRole("link", { name: /Próxima/ }).getAttribute("href")).toBe("/catalogo?q=ca&page=3");
  });

  it("estado vazio", () => {
    render(<CatalogResults query="nada" result={{ songs: [], page: 1, pageSize: 12, total: 0, totalPages: 0 }} />);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText(/Nenhuma música/)).toBeDefined();
  });
});

describe("explorar o catálogo", () => {
  it("mostra só as classificações existentes, com contagem e endereço filtrado", () => {
    render(
      <CatalogExplore
        facets={{
          moments: [{ id: "comunhao", count: 4 }],
          seasons: [{ id: "quaresma", count: 1 }],
          celebrations: [],
          themes: [],
        }}
      />,
    );

    const region = screen.getByRole("region", { name: "Explorar" });
    expect(within(region).getByRole("link", { name: /Comunhão/ }).getAttribute("href")).toBe("/catalogo?momento=comunhao");
    expect(within(region).getByRole("link", { name: /Quaresma/ }).textContent).toContain("1 música");
    expect(within(region).queryByRole("heading", { name: "Celebrações" })).toBeNull();
    expect(region.textContent).toContain("Não é uma indicação oficial da Igreja");
  });

  it("sem nenhuma classificação, a seção não aparece", () => {
    const { container } = render(<CatalogExplore facets={{ moments: [], seasons: [], celebrations: [], themes: [] }} />);
    expect(container.textContent).toBe("");
  });
});

