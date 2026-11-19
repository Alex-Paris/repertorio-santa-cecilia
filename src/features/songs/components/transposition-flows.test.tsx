import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { songRepository } from "@/features/library/data/browser-library";
import { toastStore } from "@/lib/utils/toast";
import { fakeAccount } from "@/test/fake-account-api";
import { openAccount } from "@/test/open-account";
import { RepertoireDetailScreen } from "@/features/repertoires/components/repertoire-detail-screen";

import { SongDetailScreen } from "./song-detail-screen";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  bfcacheId: "teste",
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

const SARAU = "rep-sarau-de-domingo";
const ENSAIO = "rep-ensaio-acustico";
const SARAU_CORACAO = { repertoireId: SARAU, itemId: "item-sarau-coracao" };
const ENSAIO_CORACAO = { repertoireId: ENSAIO, itemId: "item-ensaio-coracao" };

interface StoredItem {
  id: string;
  transposeSemitones: number;
  notes?: string;
}

function stored(): {
  songs: { id: string; originalKey: string; chordPro?: string }[];
  repertoires: { id: string; items: StoredItem[] }[];
} {
  return fakeAccount.library() as ReturnType<typeof stored>;
}

function storedItem(repertoireId: string, itemId: string): StoredItem | undefined {
  return stored()
    .repertoires.find((r) => r.id === repertoireId)
    ?.items.find((i) => i.id === itemId);
}

function chords(): (string | null)[] {
  return [...document.querySelectorAll("[data-chord]")]
    .map((element) => element.textContent)
    .filter(Boolean);
}

function currentKey(): string {
  const group = screen.getByRole("group", { name: "Tom de leitura" });
  return within(group).getByRole("status").textContent ?? "";
}

function clickButton(name: string): void {
  fireEvent.click(screen.getByRole("button", { name }));
}

const up = () => clickButton("Aumentar um semitom");
const down = () => clickButton("Diminuir um semitom");
const restore = () => clickButton("Restaurar tom original");

async function openSong(
  songId: string,
  contextReference?: { repertoireId: string; itemId: string },
): Promise<void> {
  render(<SongDetailScreen songId={songId} contextReference={contextReference} />);
  await screen.findByRole("heading", { level: 1 });
}

async function openRepertoire(id: string): Promise<void> {
  render(<RepertoireDetailScreen repertoireId={id} />);
  await screen.findByRole("heading", { level: 1 });
}

function rowOf(itemId: string): HTMLElement {
  const row = document.querySelector<HTMLElement>(`[data-item-id="${itemId}"]`);
  if (!row) {
    throw new Error(`linha ${itemId} não encontrada`);
  }
  return row;
}

beforeEach(async () => {
  localStorage.clear();
  await openAccount();
  router.push.mockClear();
  router.replace.mockClear();
});

describe("transposição no leitor da música", () => {
  it("exibe tom original, tom atual e os acordes atualizados imediatamente", async () => {
    await openSong("song-caminhos");
    expect(currentKey()).toBe("Tom: G");
    expect(chords().slice(0, 4)).toEqual(["G", "D", "Em", "C"]);

    up();
    up();

    expect(currentKey()).toBe("Tom: A(+2)");
    expect(chords().slice(0, 4)).toEqual(["A", "E", "F#m", "D"]);
    expect(screen.getByText("Tom original").parentElement?.textContent).toContain("G");
  });

  it("restaura o tom original e sua grafia", async () => {
    await openSong("song-caminhos");
    const original = chords();

    up();
    down();
    down();
    expect(currentKey()).toBe("Tom: Gb(-1)");

    restore();

    expect(currentKey()).toBe("Tom: G");
    expect(chords()).toEqual(original);
  });

  it("mantém a letra igual e cada acorde sobre o mesmo trecho", async () => {
    await openSong("song-caminhos");
    const sheet = screen.getByRole("article");
    const pairs = () =>
      [...sheet.querySelectorAll("[data-chord]")].map((chord) => chord.nextElementSibling?.textContent);
    const lyrics = () =>
      [...sheet.querySelectorAll("[data-chord] + span")].map((text) => text.textContent).join("");
    const before = { pairs: pairs(), lyrics: lyrics() };

    up();
    up();
    up();

    expect(pairs()).toEqual(before.pairs);
    expect(lyrics()).toEqual(before.lyrics);
    expect(sheet.textContent).not.toMatch(/[{}[\]]/);
  });

  it("não altera a música salva ao transpor", async () => {
    await openSong("song-caminhos");
    const before = stored().songs.find((s) => s.id === "song-caminhos");

    up();
    up();

    expect(stored().songs.find((s) => s.id === "song-caminhos")).toEqual(before);
    expect(before?.chordPro).toContain("[G]Hoje");
  });

  it("não persiste o ajuste temporário ao reabrir a música", async () => {
    await openSong("song-caminhos");
    up();
    cleanup();

    await openSong("song-caminhos");

    expect(currentKey()).toBe("Tom: G");
  });

  it("respeita os limites nos controles", async () => {
    await openSong("song-caminhos");

    for (let i = 0; i < 13; i++) {
      up();
    }
    expect(currentKey()).toContain("(+11)");
    expect(screen.getByRole("button", { name: "Aumentar um semitom" }).getAttribute("aria-disabled")).toBe("true");

    restore();
    for (let i = 0; i < 13; i++) {
      down();
    }
    expect(currentKey()).toContain("(-11)");
    expect(screen.getByRole("button", { name: "Diminuir um semitom" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("só oferece a restauração quando o tom foi alterado", async () => {
    // Barra compacta do leitor: no tom original não há o que restaurar, e o botão não aparece.
    await openSong("song-caminhos");
    expect(screen.queryByRole("button", { name: "Restaurar tom original" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar um semitom" }));
    fireEvent.click(screen.getByRole("button", { name: "Restaurar tom original" }));
    expect(screen.queryByRole("button", { name: "Restaurar tom original" })).toBeNull();
  });

  it("não oferece transposição em música sem cifra", async () => {
    const created = await songRepository.create({
      title: "Sem cifra",
      artist: "Pessoa",
      originalKey: "C",
      contentType: "original",
    });

    await openSong(created.id);

    expect(screen.queryByRole("group", { name: "Tom de leitura" })).toBeNull();
  });
});

describe("link externo", () => {
  it("não oferece transposição no leitor", async () => {
    await openSong("song-noite-no-cais");
    expect(screen.queryByRole("group", { name: "Tom de leitura" })).toBeNull();
    expect(screen.getByRole("link", { name: /Abrir fonte original/ })).toBeDefined();
  });

  it("não oferece transposição no repertório, mas permite anotações", async () => {
    await openRepertoire(SARAU);

    clickButton("Ajustar tom e anotações de Noite no Cais");

    expect(screen.queryByRole("group", { name: "Tom de leitura" })).toBeNull();
    expect(screen.getByLabelText("Anotações")).toBeDefined();
  });

  it("mostra as anotações ao abrir pelo repertório, sem controles de tom", async () => {
    await openRepertoire(SARAU);
    clickButton("Ajustar tom e anotações de Noite no Cais");
    fireEvent.change(screen.getByLabelText("Anotações"), { target: { value: "Só o refrão" } });
    clickButton("Salvar anotações");
    await within(rowOf("item-sarau-noite")).findByText("Só o refrão");
    cleanup();

    await openSong("song-noite-no-cais", { repertoireId: SARAU, itemId: "item-sarau-noite" });

    expect(screen.getByText("Só o refrão")).toBeDefined();
    expect(screen.queryByRole("group", { name: "Tom de leitura" })).toBeNull();
  });
});

describe("tom por repertório", () => {
  it("configura o tom no item e atualiza a linha", async () => {
    await openRepertoire(SARAU);
    expect(rowOf("item-sarau-coracao").textContent).not.toContain("original");

    clickButton("Ajustar tom e anotações de Coração de Vento");
    up();
    up();

    await waitFor(() => expect(rowOf("item-sarau-coracao").textContent).toContain("original C"));
    expect(storedItem(SARAU, "item-sarau-coracao")?.transposeSemitones).toBe(2);
    expect(stored().songs.find((s) => s.id === "song-coracao-de-vento")?.originalKey).toBe("C");
  });

  it("mantém tom diferente em outro repertório", async () => {
    await openRepertoire(SARAU);
    clickButton("Ajustar tom e anotações de Coração de Vento");
    down();
    down();
    await waitFor(() =>
      expect(storedItem(SARAU, "item-sarau-coracao")?.transposeSemitones).toBe(-2),
    );
    cleanup();

    await openRepertoire(ENSAIO);

    expect(rowOf("item-ensaio-coracao").textContent).toContain("D");
    expect(storedItem(ENSAIO, "item-ensaio-coracao")?.transposeSemitones).toBe(2);
  });

  it("não altera outro item do mesmo repertório", async () => {
    await openRepertoire(SARAU);
    const other = storedItem(SARAU, "item-sarau-luz");

    clickButton("Ajustar tom e anotações de Coração de Vento");
    up();

    await waitFor(() =>
      expect(storedItem(SARAU, "item-sarau-coracao")?.transposeSemitones).toBe(1),
    );
    expect(storedItem(SARAU, "item-sarau-luz")).toEqual(other);
  });

  it("persiste ajustes depois de recarregar a tela", async () => {
    await openRepertoire(SARAU);
    clickButton("Ajustar tom e anotações de Coração de Vento");
    up();
    await waitFor(() =>
      expect(storedItem(SARAU, "item-sarau-coracao")?.transposeSemitones).toBe(1),
    );
    cleanup();

    await openRepertoire(SARAU);

    expect(rowOf("item-sarau-coracao").textContent).toContain("C#");
    expect(rowOf("item-sarau-coracao").textContent).toContain("original C");
  });

  it("gera link com o contexto do item", async () => {
    await openRepertoire(SARAU);

    const link = within(rowOf("item-sarau-coracao")).getByRole("link");

    expect(link.getAttribute("href")).toBe(
      `/musicas/song-coracao-de-vento?repertoireId=${SARAU}&itemId=item-sarau-coracao`,
    );
  });

  it("informa falha ao salvar sem mudar o tom exibido", async () => {
    await openSong("song-coracao-de-vento", ENSAIO_CORACAO);
    const toasts = toastStore.getSnapshot().length;
    fakeAccount.fail(() => new Response(JSON.stringify({ error: { code: "x", message: "x" } }), { status: 503 }));

    up();

    await waitFor(() => expect(toastStore.getSnapshot().length).toBeGreaterThan(toasts));
    await waitFor(() => expect(currentKey()).toBe("Tom: D(+2)"));
  });
});

describe("anotações do item", () => {
  it("edita e exibe a anotação no detalhe do repertório", async () => {
    await openRepertoire(SARAU);

    clickButton("Ajustar tom e anotações de Coração de Vento");
    fireEvent.change(screen.getByLabelText("Anotações"), {
      target: { value: "Repetir refrão duas vezes" },
    });
    clickButton("Salvar anotações");

    expect(await within(rowOf("item-sarau-coracao")).findByText("Repetir refrão duas vezes")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Salvar anotações" })).toBeNull();
    expect(storedItem(SARAU, "item-sarau-coracao")?.notes).toBe("Repetir refrão duas vezes");
  });

  it("mantém anotações separadas para a mesma música em outro repertório", async () => {
    await openRepertoire(SARAU);
    clickButton("Ajustar tom e anotações de Coração de Vento");
    fireEvent.change(screen.getByLabelText("Anotações"), { target: { value: "Só no Sarau" } });
    clickButton("Salvar anotações");
    await waitFor(() =>
      expect(storedItem(SARAU, "item-sarau-coracao")?.notes).toBe("Só no Sarau"),
    );

    expect(storedItem(ENSAIO, "item-ensaio-coracao")).not.toHaveProperty("notes");
  });

  it("mostra erro claro quando o texto é longo demais", async () => {
    await openRepertoire(SARAU);
    clickButton("Ajustar tom e anotações de Coração de Vento");

    fireEvent.change(screen.getByLabelText("Anotações"), { target: { value: "x".repeat(501) } });
    clickButton("Salvar anotações");

    expect(screen.getByText("As anotações devem ter no máximo 500 caracteres.")).toBeDefined();
    expect(storedItem(SARAU, "item-sarau-coracao")).not.toHaveProperty("notes");
  });

  it("exibe marcação como texto, sem interpretar HTML", async () => {
    await openRepertoire(SARAU);
    clickButton("Ajustar tom e anotações de Coração de Vento");
    fireEvent.change(screen.getByLabelText("Anotações"), {
      target: { value: "<img src=x><b>forte</b>" },
    });
    clickButton("Salvar anotações");

    const row = rowOf("item-sarau-coracao");
    expect(await within(row).findByText("<img src=x><b>forte</b>")).toBeDefined();
    expect(row.querySelector("img")).toBeNull();
    expect(row.querySelector("b")).toBeNull();
  });
});

describe("leitura a partir do repertório", () => {
  it("usa o tom, o nome e as anotações do item, com retorno ao repertório", async () => {
    await openSong("song-luz-da-varanda", {
      repertoireId: SARAU,
      itemId: "item-sarau-luz",
    });

    const panel = within(screen.getByRole("complementary", { name: "Leitura no repertório" }));
    expect(currentKey()).toBe("Tom: C(-2)");
    expect(chords()[0]).toBe("C");
    expect(panel.getByRole("link", { name: "Sarau de Domingo" })).toBeDefined();
    expect(panel.getByText("Tom configurado").parentElement?.textContent).toContain("C");
    expect(panel.getByText("Tom mais confortável para a segunda voz.")).toBeDefined();
    expect(screen.getAllByRole("link", { name: "Sarau de Domingo" })[0].getAttribute("href")).toBe(
      `/repertorios/${SARAU}`,
    );
  });

  it("persiste a alteração no item e reabre no novo tom", async () => {
    await openSong("song-coracao-de-vento", ENSAIO_CORACAO);
    expect(currentKey()).toBe("Tom: D(+2)");

    up();

    await waitFor(() => expect(currentKey()).toBe("Tom: D#(+3)"));
    expect(storedItem(ENSAIO, "item-ensaio-coracao")?.transposeSemitones).toBe(3);
    cleanup();

    await openSong("song-coracao-de-vento", ENSAIO_CORACAO);
    expect(currentKey()).toBe("Tom: D#(+3)");
  });

  it("usa o deslocamento de cada repertório para a mesma música", async () => {
    await openSong("song-coracao-de-vento", ENSAIO_CORACAO);
    expect(currentKey()).toBe("Tom: D(+2)");
    cleanup();

    await openSong("song-coracao-de-vento", SARAU_CORACAO);
    expect(currentKey()).toBe("Tom: C");
  });

  it("abre no tom original pela biblioteca, mesmo com tom configurado", async () => {
    await openSong("song-coracao-de-vento");

    expect(currentKey()).toBe("Tom: C");
    expect(screen.queryByRole("complementary", { name: "Leitura no repertório" })).toBeNull();
    expect(screen.getByRole("link", { name: "Músicas" }).getAttribute("href")).toBe("/biblioteca");
    expect(screen.queryByText(/deste link/)).toBeNull();
  });

  it("não persiste no repertório o ajuste feito pela biblioteca", async () => {
    await openSong("song-coracao-de-vento");

    up();

    expect(storedItem(ENSAIO, "item-ensaio-coracao")?.transposeSemitones).toBe(2);
    expect(storedItem(SARAU, "item-sarau-coracao")?.transposeSemitones).toBe(0);
  });
});

describe("contexto inválido não se aplica ao item errado", () => {
  it.each([
    ["item de outra música", { repertoireId: SARAU, itemId: "item-sarau-luz" }],
    ["item de outro repertório", { repertoireId: SARAU, itemId: "item-ensaio-coracao" }],
    ["repertório inexistente", { repertoireId: "nao-existe", itemId: "item-sarau-coracao" }],
    ["item inexistente", { repertoireId: SARAU, itemId: "nao-existe" }],
  ])("ignora %s e abre no tom original", async (_name, reference) => {
    await openSong("song-coracao-de-vento", reference);
    const before = stored().repertoires;

    expect(currentKey()).toBe("Tom: C");
    expect(screen.queryByRole("complementary", { name: "Leitura no repertório" })).toBeNull();
    expect(screen.getByText(/repertório deste link não foi encontrado/)).toBeDefined();

    up();

    expect(currentKey()).toBe("Tom: C#(+1)");
    expect(stored().repertoires).toEqual(before);
  });
});
