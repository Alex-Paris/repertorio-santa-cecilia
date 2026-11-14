import { Link2Off, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";

/** Mesma resposta para link inválido, revogado ou inexistente: não revela qual é o caso. */
export function ShareUnavailable() {
  return (
    <EmptyState
      icon={Link2Off}
      title="Link indisponível"
      description="Este link não existe ou não está mais disponível."
    />
  );
}

export function ShareTemporarilyUnavailable() {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="Não foi possível abrir agora"
      description="O serviço está temporariamente indisponível. Tente novamente em instantes."
    />
  );
}
