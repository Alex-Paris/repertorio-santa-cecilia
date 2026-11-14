import { LibraryError } from "@/features/library/domain/library-errors";
import { momentOrder, type LiturgicalMomentId } from "@/features/liturgy/domain/vocabulary";
import type { SongId, SongSource } from "@/features/songs/domain/song";

import {
  createRepertoireItem,
  type Repertoire,
  type RepertoireItem,
  type RepertoireItemChanges,
  type RepertoireItemId,
} from "../domain/repertoire";
import { sortRepertoireItems } from "./repertoire-service";

export type MoveDirection = "up" | "down";

function withSequentialPositions(items: readonly RepertoireItem[]): RepertoireItem[] {
  return items.map((item, index) => ({ ...item, position: index + 1 }));
}

/** Regra única dos repositórios: operar sobre um item inexistente é sempre um erro. */
export function requireRepertoireItem(
  items: readonly RepertoireItem[],
  itemId: RepertoireItemId,
): RepertoireItem {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new LibraryError("repertoire-item-not-found");
  }
  return item;
}

/**
 * Onde um item com momento entra: depois do último item de momento igual ou anterior; sem
 * nenhum assim, antes do primeiro de momento posterior. Itens sem momento não são movidos.
 */
function insertionIndex(sorted: readonly RepertoireItem[], moment: LiturgicalMomentId | undefined): number {
  if (!moment) {
    return sorted.length;
  }
  const order = momentOrder(moment);
  const lastBefore = sorted.findLastIndex((item) => item.moment !== undefined && momentOrder(item.moment) <= order);
  if (lastBefore !== -1) {
    return lastBefore + 1;
  }
  const firstAfter = sorted.findIndex((item) => item.moment !== undefined && momentOrder(item.moment) > order);
  return firstAfter === -1 ? sorted.length : firstAfter;
}

/** Sem momento, a música vai para o fim. Com momento, entra na ordem da missa. */
export function appendRepertoireItem(
  items: readonly RepertoireItem[],
  songId: SongId,
  itemId: RepertoireItemId,
  source: SongSource = "personal",
  moment?: LiturgicalMomentId,
): RepertoireItem[] {
  const sorted = sortRepertoireItems(items);
  const index = insertionIndex(sorted, moment);
  const item = createRepertoireItem({ id: itemId, songId, source, position: index + 1, ...(moment ? { moment } : {}) });
  return withSequentialPositions([...sorted.slice(0, index), item, ...sorted.slice(index)]);
}

/** A mesma música não entra duas vezes no repertório; a origem faz parte da identidade. */
export function hasSongInRepertoire(
  items: readonly RepertoireItem[],
  source: SongSource,
  songId: SongId,
): boolean {
  return items.some((item) => item.source === source && item.songId === songId);
}

export function removeRepertoireItem(
  items: readonly RepertoireItem[],
  itemId: RepertoireItemId,
): RepertoireItem[] {
  return withSequentialPositions(
    sortRepertoireItems(items).filter((item) => item.id !== itemId),
  );
}

/** Troca o item de lugar com o vizinho; nos limites da lista, apenas normaliza as posições. */
export function moveRepertoireItem(
  items: readonly RepertoireItem[],
  itemId: RepertoireItemId,
  direction: MoveDirection,
): RepertoireItem[] {
  const sorted = sortRepertoireItems(items);
  const from = sorted.findIndex((item) => item.id === itemId);
  const to = direction === "up" ? from - 1 : from + 1;

  if (from !== -1 && to >= 0 && to < sorted.length) {
    [sorted[from], sorted[to]] = [sorted[to], sorted[from]];
  }

  return withSequentialPositions(sorted);
}

export function applyRepertoireItemChanges(
  item: RepertoireItem,
  changes: RepertoireItemChanges,
): RepertoireItem {
  const { notes: currentNotes, moment: currentMoment, ...rest } = item;
  const notes = changes.notes === undefined ? currentNotes : changes.notes;
  const moment = changes.moment === undefined ? currentMoment : changes.moment;

  return {
    ...rest,
    ...(changes.transposeSemitones !== undefined && {
      transposeSemitones: changes.transposeSemitones,
    }),
    ...(notes ? { notes } : {}),
    ...(moment ? { moment } : {}),
  };
}

export function findRepertoiresUsingSong(
  repertoires: readonly Repertoire[],
  songId: SongId,
): Repertoire[] {
  return repertoires.filter((repertoire) =>
    repertoire.items.some((item) => item.source === "personal" && item.songId === songId),
  );
}
