import type { Repertoire, RepertoireItem, RepertoireItemId } from "../domain/repertoire";
import { sortRepertoireItems } from "./repertoire-service";

export interface RepertoireNavigation {
  /** Posição na ordem do repertório, começando em 1. */
  position: number;
  total: number;
  previous: RepertoireItem | null;
  next: RepertoireItem | null;
}

/** Vizinhos de um item segundo `position`, independentemente da ordem física do array. */
export function getRepertoireNavigation(
  repertoire: Repertoire,
  itemId: RepertoireItemId,
): RepertoireNavigation | null {
  const items = sortRepertoireItems(repertoire.items);
  const index = items.findIndex((item) => item.id === itemId);

  if (index === -1) {
    return null;
  }

  return {
    position: index + 1,
    total: items.length,
    previous: items[index - 1] ?? null,
    next: items[index + 1] ?? null,
  };
}
