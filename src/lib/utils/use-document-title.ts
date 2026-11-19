"use client";

import { useEffect } from "react";

import { SITE_NAME } from "@/lib/site";

/** Título da aba para conteúdo que só é conhecido no navegador. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${SITE_NAME}`;
  }, [title]);
}
