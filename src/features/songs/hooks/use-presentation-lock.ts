"use client";

import { useLayoutEffect, type RefObject } from "react";

/** Marca o que fica atrás do modo apresentação e não pode receber foco. */
const BACKGROUND_SELECTOR = "[data-app-chrome]";

/** Bloqueia a página ao fundo enquanto o painel existir e devolve tudo ao sair. */
export function usePresentationLock(containerRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    const previousFocus = document.activeElement;
    const background = [...document.querySelectorAll(BACKGROUND_SELECTOR)];

    root.style.overflow = "hidden";
    background.forEach((element) => element.setAttribute("inert", ""));
    containerRef.current?.focus({ preventScroll: true });

    return () => {
      root.style.overflow = previousOverflow;
      background.forEach((element) => element.removeAttribute("inert"));

      const target =
        previousFocus instanceof HTMLElement && previousFocus.isConnected
          ? previousFocus
          : document.getElementById("conteudo");
      target?.focus({ preventScroll: true });
    };
  }, [containerRef]);
}
