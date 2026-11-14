"use client";

import { useEffect } from "react";

/** Título da aba para conteúdo que só é conhecido no navegador. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · Repertório`;
  }, [title]);
}
