"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import type { AccountLibrarySnapshot, DraftHold } from "../data/account-library";
import { accountLibrary } from "../data/browser-library";

/**
 * Leitura reativa da biblioteca da conta. O servidor e a hidratação sempre veem `loading`;
 * os dados só entram depois da montagem, sem divergência de HTML.
 */
export function useLibrary(): AccountLibrarySnapshot {
  return useSyncExternalStore(
    accountLibrary.subscribe,
    accountLibrary.getSnapshot,
    accountLibrary.getServerSnapshot,
  );
}

function getNoDraftHold(): null {
  return null;
}

export function useDraftHold(): DraftHold | null {
  return useSyncExternalStore(accountLibrary.subscribe, accountLibrary.getDraftHold, getNoDraftHold);
}

/**
 * Registra um formulário com texto não salvo. Se a sessão cair, a tela é mantida em vez de
 * ser trocada pelo aviso de sessão expirada. O texto fica só na memória desta aba.
 */
export function useSessionDraft(dirty: boolean): void {
  const [token] = useState(() => ({}));

  useEffect(() => {
    accountLibrary.trackDraft(token, dirty);
  }, [token, dirty]);

  useEffect(() => () => accountLibrary.trackDraft(token, false), [token]);
}
