"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** Evita um salto na volta de uma pausa do navegador. */
const MAX_FRAME_DELTA_MS = 100;
const END_TOLERANCE_PX = 1;
/** Diferença acima deste valor indica que o movimento não veio da própria rolagem. */
const MANUAL_SCROLL_TOLERANCE_PX = 3;

function getMaxScroll(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

function isAtEnd(element: HTMLElement): boolean {
  return element.scrollTop >= getMaxScroll(element) - END_TOLERANCE_PX;
}

export interface AutoScrollControls {
  isRunning: boolean;
  /** Retorna falso quando não há mais o que rolar. */
  start: () => boolean;
  pause: () => void;
  /** Retorna falso somente quando tentou iniciar e não havia o que rolar. */
  toggle: () => boolean;
  scrollToTop: () => void;
}

/** Rola o contêiner a `speed` pixels por segundo. Só começa por ação explícita. */
export function useAutoScroll(
  containerRef: RefObject<HTMLElement | null>,
  speed: number,
  onReachEnd?: () => void,
): AutoScrollControls {
  const [isRunning, setIsRunning] = useState(false);
  const speedRef = useRef(speed);
  const onReachEndRef = useRef(onReachEnd);

  useEffect(() => {
    speedRef.current = speed;
    onReachEndRef.current = onReachEnd;
  }, [speed, onReachEnd]);

  // Todo o ciclo vive neste efeito: só existe um laço, e a limpeza sempre o cancela.
  useEffect(() => {
    const element = containerRef.current;
    if (!isRunning || !element) {
      return;
    }

    let frame = 0;
    let previousTime: number | null = null;
    // A posição fracionária fica aqui, pois `scrollTop` pode arredondar o valor.
    let position = element.scrollTop;
    let written = element.scrollTop;

    const stop = (): void => setIsRunning(false);

    function step(time: number): void {
      if (!element) {
        return;
      }

      const delta = previousTime === null ? 0 : Math.min(time - previousTime, MAX_FRAME_DELTA_MS);
      previousTime = time;
      position += (speedRef.current * delta) / 1000;

      const end = getMaxScroll(element);
      if (position >= end - END_TOLERANCE_PX) {
        element.scrollTop = end;
        written = element.scrollTop;
        stop();
        onReachEndRef.current?.();
        return;
      }

      element.scrollTop = position;
      written = element.scrollTop;
      frame = requestAnimationFrame(step);
    }

    function handleScroll(): void {
      if (element && Math.abs(element.scrollTop - written) > MANUAL_SCROLL_TOLERANCE_PX) {
        stop();
      }
    }

    function handleVisibilityChange(): void {
      if (document.hidden) {
        stop();
      }
    }

    element.addEventListener("wheel", stop, { passive: true });
    element.addEventListener("touchmove", stop, { passive: true });
    element.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("wheel", stop);
      element.removeEventListener("touchmove", stop);
      element.removeEventListener("scroll", handleScroll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isRunning, containerRef]);

  const pause = useCallback(() => setIsRunning(false), []);

  const start = useCallback(() => {
    const element = containerRef.current;
    if (!element || isAtEnd(element)) {
      return false;
    }
    setIsRunning(true);
    return true;
  }, [containerRef]);

  const toggle = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
      return true;
    }
    return start();
  }, [isRunning, start]);

  const scrollToTop = useCallback(() => {
    setIsRunning(false);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [containerRef]);

  return { isRunning, start, pause, toggle, scrollToTop };
}
