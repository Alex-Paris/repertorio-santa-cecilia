import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAutoScroll } from "./use-auto-scroll";

let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let element: HTMLDivElement;

function runFrame(time: number): void {
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => callbacks.forEach((callback) => callback(time)));
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function setup(speed = 30, onReachEnd?: () => void) {
  const ref = { current: element };
  return renderHook(
    ({ currentSpeed }: { currentSpeed: number }) => useAutoScroll(ref, currentSpeed, onReachEnd),
    { initialProps: { currentSpeed: speed } },
  );
}

beforeEach(() => {
  frames = new Map();
  nextFrameId = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));

  element = document.createElement("div");
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: 1000 });
  Object.defineProperty(element, "clientHeight", { configurable: true, value: 200 });
  element.scrollTop = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
});

describe("início e pausa", () => {
  it("não começa sem ação explícita", () => {
    const { result } = setup();
    expect(result.current.isRunning).toBe(false);
    expect(frames.size).toBe(0);
  });

  it("inicia e pausa", () => {
    const { result } = setup();

    act(() => void result.current.start());
    expect(result.current.isRunning).toBe(true);
    expect(frames.size).toBe(1);

    act(() => result.current.pause());
    expect(result.current.isRunning).toBe(false);
    expect(frames.size).toBe(0);
  });

  it("alterna entre iniciar e pausar", () => {
    const { result } = setup();

    act(() => void result.current.toggle());
    expect(result.current.isRunning).toBe(true);

    act(() => void result.current.toggle());
    expect(result.current.isRunning).toBe(false);
  });

  it("não cria laços duplicados", () => {
    const { result } = setup();

    act(() => {
      result.current.start();
      result.current.start();
    });
    act(() => void result.current.start());

    expect(frames.size).toBe(1);
    runFrame(1000);
    expect(frames.size).toBe(1);
  });

  it("cancela a animação ao desmontar", () => {
    const { result, unmount } = setup();
    act(() => void result.current.start());

    unmount();

    expect(frames.size).toBe(0);
  });
});

describe("movimento", () => {
  it("usa pixels por segundo com base no tempo decorrido", () => {
    const { result } = setup(30);
    act(() => void result.current.start());

    runFrame(1000);
    expect(element.scrollTop).toBe(0);

    runFrame(1100);
    expect(element.scrollTop).toBeCloseTo(3);
  });

  it("percorre a mesma distância com qualquer quantidade de quadros", () => {
    const { result } = setup(30);
    act(() => void result.current.start());

    runFrame(1000);
    [1025, 1050, 1075, 1100].forEach(runFrame);

    expect(element.scrollTop).toBeCloseTo(3);
  });

  it("limita deltas excessivos para evitar saltos", () => {
    const { result } = setup(30);
    act(() => void result.current.start());

    runFrame(1000);
    runFrame(61000);

    expect(element.scrollTop).toBeCloseTo(3);
  });

  it("ajusta a velocidade sem reiniciar o laço", () => {
    const { result, rerender } = setup(10);
    act(() => void result.current.start());
    runFrame(1000);
    runFrame(1100);
    expect(element.scrollTop).toBeCloseTo(1);

    rerender({ currentSpeed: 80 });
    expect(frames.size).toBe(1);

    runFrame(1200);
    expect(element.scrollTop).toBeCloseTo(9);
  });

  it("volta ao início e pausa", () => {
    const { result } = setup();
    element.scrollTop = 300;
    act(() => void result.current.start());

    act(() => result.current.scrollToTop());

    expect(element.scrollTop).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(frames.size).toBe(0);
  });
});

describe("fim da cifra", () => {
  it("para no final e avisa", () => {
    const onReachEnd = vi.fn();
    const { result } = setup(80, onReachEnd);
    element.scrollTop = 798;
    act(() => void result.current.start());

    runFrame(1000);
    runFrame(1100);

    expect(element.scrollTop).toBe(800);
    expect(result.current.isRunning).toBe(false);
    expect(frames.size).toBe(0);
    expect(onReachEnd).toHaveBeenCalledOnce();
  });

  it("não inicia quando já está no final", () => {
    const { result } = setup();
    element.scrollTop = 800;

    let started = true;
    act(() => {
      started = result.current.start();
    });

    expect(started).toBe(false);
    expect(result.current.isRunning).toBe(false);
  });

  it("não inicia quando não há o que rolar", () => {
    Object.defineProperty(element, "scrollHeight", { configurable: true, value: 200 });
    const { result } = setup();

    act(() => void result.current.start());

    expect(result.current.isRunning).toBe(false);
  });
});

describe("pausas automáticas", () => {
  it("pausa quando a aba fica oculta e não retoma ao voltar", () => {
    const { result } = setup();
    act(() => void result.current.start());

    setHidden(true);
    expect(result.current.isRunning).toBe(false);

    setHidden(false);
    expect(result.current.isRunning).toBe(false);
    expect(frames.size).toBe(0);
  });

  it.each(["wheel", "touchmove"])("pausa após intervenção manual por %s", (type) => {
    const { result } = setup();
    act(() => void result.current.start());

    act(() => {
      element.dispatchEvent(new Event(type));
    });

    expect(result.current.isRunning).toBe(false);
  });

  it("pausa quando a posição muda por fora, como pela barra de rolagem", () => {
    const { result } = setup();
    act(() => void result.current.start());
    runFrame(1000);

    act(() => {
      element.scrollTop = 400;
      element.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.isRunning).toBe(false);
  });

  it("não se pausa com a própria rolagem", () => {
    const { result } = setup();
    act(() => void result.current.start());
    runFrame(1000);
    runFrame(1100);

    act(() => {
      element.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.isRunning).toBe(true);
  });

  it("não reage a intervenções depois de pausada", () => {
    const { result } = setup();
    act(() => void result.current.start());
    act(() => result.current.pause());

    act(() => {
      element.dispatchEvent(new Event("wheel"));
    });

    expect(frames.size).toBe(0);
  });
});
