import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeAccount } from "@/test/fake-account-api";
import { openAccount } from "@/test/open-account";
import { toastStore } from "@/lib/utils/toast";

import { READER_PREFERENCES_KEY, readerPreferencesStore } from "../data/reader-preferences-store";
import { DEFAULT_READER_PREFERENCES } from "../domain/reader-preferences";
import { SongDetailScreen } from "./song-detail-screen";
import { SongFormScreen } from "./song-form-screen";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  bfcacheId: "teste",
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

const SARAU = "rep-sarau-de-domingo";
const ENSAIO = "rep-ensaio-acustico";

const FIRST = { repertoireId: SARAU, itemId: "item-sarau-caminhos" };
const SECOND = { repertoireId: SARAU, itemId: "item-sarau-luz" };
const LAST = { repertoireId: SARAU, itemId: "item-sarau-noite" };

let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;

function setScrollableSize(): void {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => 2000,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 500,
  });
}

function clearScrollableSize(): void {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
}

function runFrame(time: number): void {
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => callbacks.forEach((callback) => callback(time)));
}

beforeEach(async () => {
  localStorage.clear();
  await openAccount();
  readerPreferencesStore.update(DEFAULT_READER_PREFERENCES);
  localStorage.removeItem(READER_PREFERENCES_KEY);
  window.history.replaceState(null, "", "/");
  router.push.mockClear();
  router.replace.mockClear();

  frames = new Map();
  nextFrameId = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  setScrollableSize();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearScrollableSize();
  document.querySelectorAll("[data-test-chrome]").forEach((element) => element.remove());
  Object.assign(document, { fullscreenEnabled: undefined, fullscreenElement: undefined, exitFullscreen: undefined });
  delete (document.documentElement as Partial<HTMLElement>).requestFullscreen;
});

/**
 * O Testing Library não considera `inert`: com o painel aberto, as consultas
 * ficam restritas a ele, como acontece com o usuário no navegador.
 */
function activeView(): ReturnType<typeof within> {
  const dialog = screen.queryByRole("dialog");
  return dialog ? within(dialog) : within(document.body);
}

function click(name: string | RegExp): void {
  fireEvent.click(activeView().getByRole("button", { name }));
}

async function openSong(
  songId: string,
  contextReference?: { repertoireId: string; itemId: string },
): Promise<void> {
  render(<SongDetailScreen songId={songId} contextReference={contextReference} />);
  await screen.findByRole("heading", { level: 1 });
}

async function present(
  songId = "song-caminhos",
  contextReference?: { repertoireId: string; itemId: string },
): Promise<HTMLElement> {
  await openSong(songId, contextReference);
  click("Apresentar");
  return screen.getByRole("dialog");
}

function title(): string | null | undefined {
  const dialog = screen.getByRole("dialog");
  return document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")?.textContent;
}

function dialogChords(): (string | null)[] {
  return [...screen.getByRole("dialog").querySelectorAll("[data-chord]")]
    .map((element) => element.textContent)
    .filter(Boolean);
}

function scroller(): HTMLElement {
  return screen.getByRole("region", { name: "Cifra" });
}

function sheetFontSize(container: HTMLElement): string {
  return container.querySelector<HTMLElement>("[style*='font-size']")?.style.fontSize ?? "";
}

function press(key: string, target: EventTarget = document.body, init: KeyboardEventInit = {}): boolean {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

function storedItem(repertoireId: string, itemId: string) {
  return fakeAccount
    .library()
    .repertoires.find((r) => r.id === repertoireId)
    ?.items.find((i) => i.id === itemId);
}

function setupFullscreen(request: () => Promise<void>): ReturnType<typeof vi.fn> {
  const requestFullscreen = vi.fn(request);
  Object.assign(document.documentElement, { requestFullscreen });
  Object.assign(document, {
    fullscreenEnabled: true,
    fullscreenElement: null,
    exitFullscreen: vi.fn(() => Promise.resolve()),
  });
  return requestFullscreen;
}

describe("tamanho da fonte no leitor", () => {
  it("usa o padrão e aumenta em passos de 2 px, salvando a preferência", async () => {
    await openSong("song-caminhos");
    const sheet = screen.getByRole("article");
    expect(sheetFontSize(sheet)).toBe("18px");

    click("Aumentar fonte");

    expect(sheetFontSize(sheet)).toBe("20px");
    expect(JSON.parse(localStorage.getItem(READER_PREFERENCES_KEY) ?? "").fontSize).toBe(20);
  });

  it("diminui a fonte", async () => {
    await openSong("song-caminhos");

    click("Diminuir fonte");

    expect(sheetFontSize(screen.getByRole("article"))).toBe("16px");
  });

  it("respeita os limites de 14 e 30 px", async () => {
    await openSong("song-caminhos");
    const sheet = screen.getByRole("article");

    for (let i = 0; i < 12; i++) {
      click("Aumentar fonte");
    }
    expect(sheetFontSize(sheet)).toBe("30px");
    expect(screen.getByRole("button", { name: "Aumentar fonte" }).getAttribute("aria-disabled")).toBe("true");

    for (let i = 0; i < 12; i++) {
      click("Diminuir fonte");
    }
    expect(sheetFontSize(sheet)).toBe("14px");
    expect(screen.getByRole("button", { name: "Diminuir fonte" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("restaura o tamanho padrão", async () => {
    await openSong("song-caminhos");
    click("Aumentar fonte");

    click("Restaurar tamanho padrão");

    expect(sheetFontSize(screen.getByRole("article"))).toBe("18px");
  });

  it("preserva a associação entre acordes e sílabas", async () => {
    await openSong("song-caminhos");
    const sheet = screen.getByRole("article");
    const pairs = () =>
      [...sheet.querySelectorAll("[data-chord]")].map(
        (chord) => `${chord.textContent}|${chord.nextElementSibling?.textContent}`,
      );
    const before = pairs();

    click("Aumentar fonte");
    click("Aumentar fonte");

    expect(pairs()).toEqual(before);
  });

  it("não altera a biblioteca ao mudar a fonte", async () => {
    await openSong("song-caminhos");
    const before = fakeAccount.library();

    click("Aumentar fonte");

    expect(fakeAccount.library()).toEqual(before);
  });
});

describe("modo apresentação", () => {
  it("exibe música, artista, tom e cifra, sem elementos de gerenciamento", async () => {
    const dialog = await present();
    const view = within(dialog);

    expect(title()).toBe("Caminhos");
    expect(view.getByText("Banda Exemplo")).toBeDefined();
    expect(dialog.querySelector("header")?.textContent).toContain("TomTom G");
    expect(dialogChords().slice(0, 2)).toEqual(["G", "D"]);
    expect(view.queryByRole("link", { name: "Editar" })).toBeNull();
    expect(view.queryByRole("button", { name: "Excluir" })).toBeNull();
  });

  it("bloqueia a página ao fundo e move o foco para o painel", async () => {
    const chrome = document.createElement("button");
    chrome.dataset.appChrome = "";
    chrome.dataset.testChrome = "";
    document.body.append(chrome);

    const dialog = await present();

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(chrome.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(dialog);
  });

  it("sai pelo botão e restaura rolagem, foco e controles da página", async () => {
    const chrome = document.createElement("button");
    chrome.dataset.appChrome = "";
    chrome.dataset.testChrome = "";
    document.body.append(chrome);
    await openSong("song-caminhos");
    const trigger = screen.getByRole("button", { name: "Apresentar" });
    trigger.focus();
    fireEvent.click(trigger);

    click("Sair do modo apresentação");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.documentElement.style.overflow).toBe("");
    expect(chrome.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByRole("heading", { level: 1, name: "Caminhos" })).toBeDefined();
  });

  it("começa com a rolagem pausada e não inicia sozinho", async () => {
    await present();

    expect(screen.getByRole("button", { name: "Iniciar rolagem" })).toBeDefined();
    expect(frames.size).toBe(0);
  });

  it("recolhe os controles secundários sem esconder a saída", async () => {
    await present();
    expect(activeView().queryByRole("group", { name: "Tamanho da fonte" })).toBeNull();
    expect(activeView().getByRole("button", { name: "Sair do modo apresentação" })).toBeDefined();

    click("Mostrar ajustes");

    expect(activeView().getByRole("group", { name: "Tamanho da fonte" })).toBeDefined();
    expect(activeView().getByRole("group", { name: "Rolagem automática" })).toBeDefined();
    expect(activeView().getByRole("button", { name: "Sair do modo apresentação" })).toBeDefined();

    click("Ocultar ajustes");
    expect(activeView().queryByRole("group", { name: "Tamanho da fonte" })).toBeNull();
  });

  it("aplica fonte e transposição usando o leitor existente", async () => {
    const dialog = await present();
    click("Mostrar ajustes");

    click("Aumentar fonte");
    click("Aumentar um semitom");
    click("Aumentar um semitom");

    expect(sheetFontSize(dialog)).toBe("20px");
    expect(dialogChords().slice(0, 2)).toEqual(["A", "E"]);
  });

  it("mantém o ajuste temporário de tom ao sair", async () => {
    await present();
    click("Mostrar ajustes");
    click("Aumentar um semitom");
    click("Aumentar um semitom");

    click("Sair do modo apresentação");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(screen.getByRole("group", { name: "Tom de leitura" }).textContent).toContain("A");
  });

  it("não oferece apresentação a link externo fora de repertório", async () => {
    await openSong("song-noite-no-cais");
    expect(screen.queryByRole("button", { name: "Apresentar" })).toBeNull();
  });
});

describe("rolagem no modo apresentação", () => {
  it("inicia, move somente o painel e pausa", async () => {
    await present();
    const pageScroll = window.scrollY;

    click("Iniciar rolagem");
    runFrame(1000);
    runFrame(1100);

    expect(scroller().scrollTop).toBeCloseTo(3);
    expect(window.scrollY).toBe(pageScroll);

    click("Pausar rolagem");
    expect(frames.size).toBe(0);
  });

  it("ajusta a velocidade salvando a preferência", async () => {
    await present();
    click("Mostrar ajustes");

    click("Aumentar velocidade");

    expect(JSON.parse(localStorage.getItem(READER_PREFERENCES_KEY) ?? "").scrollSpeed).toBe(35);
    expect(activeView().getByRole("group", { name: "Rolagem automática" }).textContent).toContain("35 px/s");
  });

  it("volta ao início da cifra", async () => {
    await present();
    click("Mostrar ajustes");
    scroller().scrollTop = 500;

    click("Voltar ao início");

    expect(scroller().scrollTop).toBe(0);
  });

  it("pausa após intervenção manual", async () => {
    await present();
    click("Iniciar rolagem");

    fireEvent.wheel(scroller());

    expect(screen.getByRole("button", { name: "Iniciar rolagem" })).toBeDefined();
    expect(frames.size).toBe(0);
  });

  it("para e cancela a animação ao sair", async () => {
    await present();
    click("Iniciar rolagem");
    expect(frames.size).toBe(1);

    click("Sair do modo apresentação");

    await waitFor(() => expect(frames.size).toBe(0));
  });

  it("cancela a animação ao desmontar a tela", async () => {
    await present();
    click("Iniciar rolagem");

    cleanup();

    expect(frames.size).toBe(0);
  });

  it("avisa quando chega ao final", async () => {
    await present();
    scroller().scrollTop = 1499;
    click("Iniciar rolagem");

    runFrame(1000);
    runFrame(1100);

    expect(within(screen.getByRole("dialog")).getByText(/Fim da cifra/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Iniciar rolagem" })).toBeDefined();
  });

  it("inicia somente após a ação do usuário ao reabrir", async () => {
    await present();
    click("Iniciar rolagem");
    click("Sair do modo apresentação");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    click("Apresentar");

    expect(screen.getByRole("button", { name: "Iniciar rolagem" })).toBeDefined();
    expect(frames.size).toBe(0);
  });
});

describe("preferência por menos movimento", () => {
  function stubReducedMotion(matches: boolean): void {
    vi.stubGlobal("matchMedia", () => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  }

  it("informa o usuário e mantém a rolagem pausada", async () => {
    stubReducedMotion(true);
    await present();

    click("Mostrar ajustes");

    expect(activeView().getByText(/Seu sistema pede menos movimento/)).toBeDefined();
    expect(frames.size).toBe(0);
  });

  it("não exibe o aviso sem essa preferência", async () => {
    stubReducedMotion(false);
    await present();

    click("Mostrar ajustes");

    expect(activeView().queryByText(/Seu sistema pede menos movimento/)).toBeNull();
  });
});

describe("tela cheia nativa", () => {
  it("não oferece o botão quando a API está indisponível", async () => {
    await present();
    expect(screen.queryByRole("button", { name: "Ativar tela cheia" })).toBeNull();
  });

  it("não solicita automaticamente ao entrar", async () => {
    const requestFullscreen = setupFullscreen(() => Promise.resolve());

    await present();

    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it("solicita somente com a ação do usuário e acompanha fullscreenchange", async () => {
    const requestFullscreen = setupFullscreen(() => Promise.resolve());
    await present();

    click("Ativar tela cheia");
    expect(requestFullscreen).toHaveBeenCalledOnce();

    Object.assign(document, { fullscreenElement: document.documentElement });
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(screen.getByRole("button", { name: "Sair da tela cheia" })).toBeDefined();

    Object.assign(document, { fullscreenElement: null });
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(screen.getByRole("button", { name: "Ativar tela cheia" })).toBeDefined();
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("avisa quando a solicitação é recusada e continua utilizável", async () => {
    setupFullscreen(() => Promise.reject(new Error("recusado")));
    await present();

    click("Ativar tela cheia");

    await waitFor(() =>
      expect(toastStore.getSnapshot().at(-1)?.message).toContain("Não foi possível ativar a tela cheia"),
    );
    expect(screen.getByRole("dialog")).toBeDefined();
    click("Iniciar rolagem");
    expect(frames.size).toBe(1);
  });

  it("sai da tela cheia ao fechar o modo apresentação", async () => {
    setupFullscreen(() => Promise.resolve());
    await present();
    Object.assign(document, { fullscreenElement: document.documentElement });

    click("Sair do modo apresentação");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(document.exitFullscreen).toHaveBeenCalled();
  });
});

describe("navegação entre músicas", () => {
  it("exibe posição, repertório e retorno à lista", async () => {
    const dialog = await present("song-luz-da-varanda", SECOND);
    const view = within(dialog);

    expect(view.getByText("2 de 4")).toBeDefined();
    expect(view.getByRole("link", { name: "Voltar à lista de Sarau de Domingo" }).getAttribute("href")).toBe(
      `/repertorios/${SARAU}`,
    );
  });

  it("avança carregando tom e anotações da próxima música, sem mudar de rota", async () => {
    await present("song-caminhos", FIRST);
    expect(screen.getByRole("dialog").textContent).toContain("Abrir só com o violão.");

    click("Próxima música");

    expect(title()).toBe("Luz da Varanda");
    expect(dialogChords()[0]).toBe("C");
    expect(screen.getByRole("dialog").textContent).toContain("Tom mais confortável");
    expect(screen.getByRole("dialog").textContent).not.toContain("Abrir só com o violão.");
    expect(window.location.pathname + window.location.search).toBe(
      `/musicas/song-luz-da-varanda?repertoireId=${SARAU}&itemId=item-sarau-luz`,
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("volta à música anterior com seu contexto", async () => {
    await present("song-luz-da-varanda", SECOND);

    click("Música anterior");

    expect(title()).toBe("Caminhos");
    expect(dialogChords()[0]).toBe("G");
    expect(window.location.search).toContain("itemId=item-sarau-caminhos");
  });

  it("segue position, e não a ordem física dos itens", async () => {
    await present("song-estrada-de-terra", { repertoireId: ENSAIO, itemId: "item-ensaio-estrada" });

    click("Próxima música");
    expect(title()).toBe("Maré de Setembro");

    click("Próxima música");
    expect(title()).toBe("Coração de Vento");
    expect(dialogChords()[0]).toBe("D");
  });

  it("desabilita Anterior na primeira música", async () => {
    await present("song-caminhos", FIRST);
    const previous = screen.getByRole("button", { name: "Música anterior" });

    expect(previous.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(previous);
    expect(title()).toBe("Caminhos");
  });

  it("desabilita Próxima na última, sem voltar à primeira", async () => {
    await present("song-noite-no-cais", LAST);
    const next = screen.getByRole("button", { name: "Próxima música" });

    expect(next.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(next);
    expect(title()).toBe("Noite no Cais");
  });

  it("volta ao topo, pausa e mantém as preferências ao trocar de música", async () => {
    const dialog = await present("song-caminhos", FIRST);
    click("Mostrar ajustes");
    click("Aumentar fonte");
    scroller().scrollTop = 400;
    click("Iniciar rolagem");

    click("Próxima música");

    expect(scroller().scrollTop).toBe(0);
    expect(frames.size).toBe(0);
    expect(screen.getByRole("button", { name: "Iniciar rolagem" })).toBeDefined();
    expect(sheetFontSize(dialog)).toBe("20px");
  });

  it("salva o tom no item atual depois de navegar", async () => {
    await present("song-caminhos", FIRST);
    click("Próxima música");
    click("Mostrar ajustes");

    click("Aumentar um semitom");

    await waitFor(() => expect(storedItem(SARAU, "item-sarau-luz")?.transposeSemitones).toBe(-1));
    expect(storedItem(SARAU, "item-sarau-caminhos")?.transposeSemitones).toBe(0);
  });

  it("mostra a fonte original em link externo, preservando a navegação", async () => {
    const open = vi.spyOn(window, "open");
    await present("song-coracao-de-vento", { repertoireId: SARAU, itemId: "item-sarau-coracao" });

    click("Próxima música");

    expect(title()).toBe("Noite no Cais");
    expect(dialogChords()).toEqual([]);
    expect(screen.getByRole("link", { name: /Abrir fonte original/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Iniciar rolagem" })).toBeNull();
    expect(screen.getByRole("button", { name: "Música anterior" }).getAttribute("aria-disabled")).not.toBe("true");
    expect(open).not.toHaveBeenCalled();
  });

  it("não exibe navegação em acesso pela biblioteca", async () => {
    await present();
    expect(screen.queryByRole("button", { name: "Próxima música" })).toBeNull();
  });

  it("não usa outras músicas quando o contexto é inválido", async () => {
    await present("song-caminhos", { repertoireId: SARAU, itemId: "item-sarau-luz" });

    expect(screen.queryByRole("button", { name: "Próxima música" })).toBeNull();
    expect(dialogChords()[0]).toBe("G");
  });

  it("leva a página à música atual ao sair depois de navegar", async () => {
    await present("song-caminhos", FIRST);
    click("Próxima música");

    click("Sair do modo apresentação");

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        `/musicas/song-luz-da-varanda?repertoireId=${SARAU}&itemId=item-sarau-luz`,
      ),
    );
  });

  it("não troca de rota ao sair sem ter navegado", async () => {
    await present("song-caminhos", FIRST);

    click("Sair do modo apresentação");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("navegação na leitura normal", () => {
  it("oferece anterior e próxima com o contexto de cada item", async () => {
    await openSong("song-luz-da-varanda", SECOND);
    const nav = within(screen.getByRole("navigation", { name: "Músicas do repertório" }));

    expect(nav.getByText("Música 2 de 4")).toBeDefined();
    expect(nav.getByRole("link", { name: "Anterior" }).getAttribute("href")).toBe(
      `/musicas/song-caminhos?repertoireId=${SARAU}&itemId=item-sarau-caminhos`,
    );
    expect(nav.getByRole("link", { name: "Próxima" }).getAttribute("href")).toBe(
      `/musicas/song-coracao-de-vento?repertoireId=${SARAU}&itemId=item-sarau-coracao`,
    );
  });

  it("desabilita os extremos", async () => {
    await openSong("song-caminhos", FIRST);
    const nav = within(screen.getByRole("navigation", { name: "Músicas do repertório" }));
    expect((nav.getByRole("button", { name: "Anterior" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("não exibe navegação pela biblioteca", async () => {
    await openSong("song-caminhos");
    expect(screen.queryByRole("navigation", { name: "Músicas do repertório" })).toBeNull();
  });
});

describe("atalhos de teclado", () => {
  it("Espaço inicia e pausa a rolagem", async () => {
    await present();

    expect(press(" ")).toBe(true);
    expect(frames.size).toBe(1);

    press(" ");
    expect(frames.size).toBe(0);
  });

  it("setas trocam de música", async () => {
    await present("song-luz-da-varanda", SECOND);

    press("ArrowRight");
    expect(title()).toBe("Coração de Vento");

    press("ArrowLeft");
    expect(title()).toBe("Luz da Varanda");
  });

  it("Escape sai do modo apresentação", async () => {
    await present();

    press("Escape");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("não navega quando não existe próxima ou anterior", async () => {
    await present("song-caminhos", FIRST);

    expect(press("ArrowLeft")).toBe(false);
    expect(title()).toBe("Caminhos");
  });

  it("não captura teclas em campos editáveis", async () => {
    await present("song-luz-da-varanda", SECOND);
    const input = document.createElement("input");
    input.dataset.testChrome = "";
    document.body.append(input);

    expect(press(" ", input)).toBe(false);
    expect(press("ArrowRight", input)).toBe(false);
    press("Escape", input);

    expect(frames.size).toBe(0);
    expect(title()).toBe("Luz da Varanda");
  });

  it("não interfere na barra de espaço de botões", async () => {
    await present();
    const button = screen.getByRole("button", { name: "Mostrar ajustes" });

    expect(press(" ", button)).toBe(false);
    expect(frames.size).toBe(0);
  });

  it("ignora combinações com modificadores", async () => {
    await present("song-luz-da-varanda", SECOND);

    expect(press("ArrowRight", document.body, { altKey: true })).toBe(false);
    expect(title()).toBe("Luz da Varanda");
  });

  it("não duplica listeners e os remove ao sair", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    await present("song-luz-da-varanda", SECOND);
    const added = add.mock.calls.filter(([type]) => type === "keydown");
    expect(added).toHaveLength(1);

    press("ArrowRight");
    expect(title()).toBe("Coração de Vento");
    expect(add.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);

    click("Sair do modo apresentação");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(remove.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
    press("Escape");
  });
});

describe("contexto preservado na edição", () => {
  it("o link de edição carrega o contexto validado", async () => {
    await openSong("song-caminhos", FIRST);

    fireEvent.click(screen.getByRole("button", { name: "Mais ações da música" }));
    expect(screen.getByRole("link", { name: "Editar" }).getAttribute("href")).toBe(
      `/musicas/song-caminhos/editar?repertoireId=${SARAU}&itemId=item-sarau-caminhos`,
    );
  });

  it("sem contexto, o link de edição é o normal", async () => {
    await openSong("song-caminhos");
    fireEvent.click(screen.getByRole("button", { name: "Mais ações da música" }));
    expect(screen.getByRole("link", { name: "Editar" }).getAttribute("href")).toBe(
      "/musicas/song-caminhos/editar",
    );
  });

  it("contexto inválido não entra no link de edição", async () => {
    await openSong("song-caminhos", SECOND);
    fireEvent.click(screen.getByRole("button", { name: "Mais ações da música" }));
    expect(screen.getByRole("link", { name: "Editar" }).getAttribute("href")).toBe(
      "/musicas/song-caminhos/editar",
    );
  });

  async function openEditor(reference?: { repertoireId: string; itemId: string }): Promise<void> {
    render(<SongFormScreen songId="song-caminhos" contextReference={reference} />);
    await screen.findByLabelText("Título");
  }

  it("volta à leitura contextual depois de salvar", async () => {
    await openEditor(FIRST);

    click("Salvar música");

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        `/musicas/song-caminhos?repertoireId=${SARAU}&itemId=item-sarau-caminhos`,
      ),
    );
  });

  it("volta à leitura contextual ao cancelar", async () => {
    await openEditor(FIRST);

    expect(screen.getByRole("link", { name: "Cancelar" }).getAttribute("href")).toBe(
      `/musicas/song-caminhos?repertoireId=${SARAU}&itemId=item-sarau-caminhos`,
    );
  });

  it.each([
    ["item de outra música", SECOND],
    ["repertório inexistente", { repertoireId: "nao-existe", itemId: "item-sarau-caminhos" }],
  ])("ignora %s e volta à música normal", async (_name, reference) => {
    await openEditor(reference);

    expect(screen.getByRole("link", { name: "Cancelar" }).getAttribute("href")).toBe(
      "/musicas/song-caminhos",
    );

    click("Salvar música");
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/musicas/song-caminhos"));
  });

  it("não grava o contexto no documento da música", async () => {
    await openEditor(FIRST);

    click("Salvar música");
    await waitFor(() => expect(router.push).toHaveBeenCalled());

    const song = fakeAccount.library().songs.find((s) => s.id === "song-caminhos");
    expect(song).not.toHaveProperty("repertoireId");
    expect(song).not.toHaveProperty("itemId");
  });
});
