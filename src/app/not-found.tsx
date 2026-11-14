import { Compass } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/layout/empty-state";

export const metadata: Metadata = { title: "Página não encontrada" };

/** Sem a navegação da aplicação: esta árvore acompanha também as páginas públicas (`/s`). */
export default function RootNotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Página não encontrada"
      description="O endereço acessado não existe ou foi alterado."
    />
  );
}
