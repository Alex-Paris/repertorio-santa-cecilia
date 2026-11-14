import { useSyncExternalStore } from "react";

import { repertoireRepository } from "@/features/library/data/browser-library";
import { getLibraryErrorMessage, LibraryError } from "@/features/library/domain/library-errors";
import type { Revision } from "@/features/songs/domain/song";
import { showToast } from "@/lib/utils/toast";

import type { RepertoireReadingContext } from "../services/repertoire-reading-context";

const pending = new Map<string, number>();
const inFlight = new Set<string>();
const listeners = new Set<() => void>();

const CONFLICT_MESSAGE =
  "O repertório foi alterado em outro dispositivo ou aba. O tom não foi salvo; confira a versão atual e ajuste de novo.";

function publish(key: string, value: number | null): void {
  if (value === null) {
    pending.delete(key);
  } else {
    pending.set(key, value);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getKey(repertoireId: string, itemId: string): string {
  return `${repertoireId}/${itemId}`;
}

/**
 * Grava o tom no item do repertório. Cliques seguidos somam a partir do valor mostrado e são
 * enviados um de cada vez, sempre o mais recente. Nenhum clique é descartado em silêncio: se a
 * gravação falhar, o tom confirmado volta a ser exibido e a falha é avisada.
 */
export async function saveSemitones(
  repertoireId: string,
  itemId: string,
  transposeSemitones: number,
  expectedRevision: Revision,
): Promise<void> {
  const key = getKey(repertoireId, itemId);
  publish(key, transposeSemitones);

  if (inFlight.has(key)) {
    return;
  }
  inFlight.add(key);

  try {
    let sent: number;
    do {
      sent = pending.get(key) as number;
      // A mesma revisão de partida: a biblioteca encadeia as revisões que esta aba produziu.
      await repertoireRepository.updateItem(
        repertoireId,
        itemId,
        { transposeSemitones: sent },
        expectedRevision,
      );
    } while (pending.get(key) !== sent);
  } catch (error) {
    showToast(
      error instanceof LibraryError && error.code === "revision-conflict"
        ? CONFLICT_MESSAGE
        : getLibraryErrorMessage(error),
      "error",
    );
  } finally {
    inFlight.delete(key);
    publish(key, null);
  }
}

export function saveItemSemitones(
  { repertoire, item }: RepertoireReadingContext,
  transposeSemitones: number,
): Promise<void> {
  return saveSemitones(repertoire.id, item.id, transposeSemitones, repertoire.revision);
}

type ItemReference = { repertoireId: string; itemId: string } | null;

/** O tom a exibir: o que está sendo gravado ou, sem envio em andamento, o confirmado. */
export function useItemSemitones(reference: ItemReference, confirmed: number): number {
  const key = reference ? getKey(reference.repertoireId, reference.itemId) : null;
  const value = useSyncExternalStore(
    subscribe,
    () => (key ? pending.get(key) : undefined),
    () => undefined,
  );
  return value ?? confirmed;
}

/** Se há tom deste item ainda aguardando confirmação do servidor. */
export function useItemSemitonesSaving(reference: ItemReference): boolean {
  const key = reference ? getKey(reference.repertoireId, reference.itemId) : null;
  return useSyncExternalStore(
    subscribe,
    () => (key ? pending.has(key) : false),
    () => false,
  );
}
