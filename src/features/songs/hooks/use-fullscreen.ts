"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { showToast } from "@/lib/utils/toast";

const FULLSCREEN_ERROR =
  "Não foi possível ativar a tela cheia. O modo apresentação continua funcionando.";

function subscribeToNothing(): () => void {
  return () => {};
}

function subscribeToFullscreen(listener: () => void): () => void {
  document.addEventListener("fullscreenchange", listener);
  return () => document.removeEventListener("fullscreenchange", listener);
}

function getIsSupported(): boolean {
  return (
    typeof document.documentElement.requestFullscreen === "function" &&
    document.fullscreenEnabled === true
  );
}

function getIsActive(): boolean {
  return Boolean(document.fullscreenElement);
}

function getFalse(): boolean {
  return false;
}

export interface FullscreenControls {
  isSupported: boolean;
  isActive: boolean;
  toggle: () => Promise<void>;
}

/**
 * Tela cheia nativa, sempre a partir de uma ação do usuário. Aplica-se ao documento,
 * e não a um elemento da tela, para sobreviver a qualquer troca de conteúdo.
 */
export function useFullscreen(): FullscreenControls {
  const isSupported = useSyncExternalStore(subscribeToNothing, getIsSupported, getFalse);
  const isActive = useSyncExternalStore(subscribeToFullscreen, getIsActive, getFalse);

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      showToast(FULLSCREEN_ERROR, "error");
    }
  }, []);

  useEffect(
    () => () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {
          // O navegador já pode ter saído da tela cheia por conta própria.
        });
      }
    },
    [],
  );

  return { isSupported, isActive, toggle };
}
