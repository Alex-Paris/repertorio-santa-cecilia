"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { accountLibrary } from "../data/browser-library";

/** Busca os dados de novo no servidor: não há atualização em tempo real entre aparelhos. */
export function RefreshLibraryButton() {
  return (
    <Button variant="ghost" size="lg" onClick={() => void accountLibrary.retry()}>
      <RefreshCw data-icon="inline-start" aria-hidden />
      Atualizar
    </Button>
  );
}
