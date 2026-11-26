"use client";

import { ArrowDown, ArrowUp, ListMusic, SlidersHorizontal, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { MoreActionsMenu, MENU_ITEM_CLASS } from "@/components/layout/more-actions-menu";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { repertoireRepository } from "@/features/library/data/browser-library";
import { getLibraryErrorMessage } from "@/features/library/domain/library-errors";
import { showToast } from "@/lib/utils/toast";

import type { Revision } from "@/features/songs/domain/song";

import type { RepertoireId, RepertoireItemId } from "../domain/repertoire";
import type { MoveDirection } from "../services/repertoire-items";
import type { RepertoireEntry } from "../services/repertoire-service";
import { RepertoireEntryRow } from "./repertoire-entry-row";
import { RepertoireItemEditor } from "./repertoire-item-editor";

interface RepertoireEntryListProps {
  repertoireId: RepertoireId;
  revision: Revision;
  entries: RepertoireEntry[];
  /** Repertório de missa: cada item pode ter um momento litúrgico. */
  forMass?: boolean;
}

function getSongLabel(entry: RepertoireEntry): string {
  return entry.song?.title ?? "música indisponível";
}

export function RepertoireEntryList({ repertoireId, revision, entries, forMass = false }: RepertoireEntryListProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const restoreFocus = useRef<((list: HTMLOListElement) => void) | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [editingItemId, setEditingItemId] = useState<RepertoireItemId | null>(null);

  // A linha muda de lugar ou some: o foco do teclado não pode se perder junto com ela.
  useLayoutEffect(() => {
    if (listRef.current && restoreFocus.current) {
      restoreFocus.current(listRef.current);
    }
    restoreFocus.current = null;
  }, [entries]);

  async function handleMove(entry: RepertoireEntry, direction: MoveDirection): Promise<void> {
    const targetIndex = entries.indexOf(entry) + (direction === "up" ? -1 : 1);

    restoreFocus.current = (list) => {
      const row = [...list.children].find(
        (candidate) => candidate instanceof HTMLElement && candidate.dataset.itemId === entry.item.id,
      );
      const button =
        row?.querySelector<HTMLElement>(`[data-move="${direction}"]:not(:disabled)`) ??
        row?.querySelector<HTMLElement>("[data-move]:not(:disabled)") ?? row?.querySelector<HTMLElement>("[data-more-trigger]");
      button?.focus();
    };

    try {
      await repertoireRepository.moveItem(repertoireId, entry.item.id, direction, revision);
      setAnnouncement(`${getSongLabel(entry)} agora é a música ${targetIndex + 1}.`);
    } catch (error) {
      restoreFocus.current = null;
      showToast(getLibraryErrorMessage(error), "error");
    }
  }

  async function handleRemove(entry: RepertoireEntry): Promise<void> {
    const removedIndex = entries.indexOf(entry);

    restoreFocus.current = (list) => {
      const row = list.children[Math.min(removedIndex, list.children.length - 1)];
      row?.querySelector<HTMLElement>("[data-more-trigger]")?.focus();
    };

    try {
      await repertoireRepository.removeItem(repertoireId, entry.item.id, revision);
      showToast(`“${getSongLabel(entry)}” removida do repertório.`);
    } catch (error) {
      restoreFocus.current = null;
      showToast(getLibraryErrorMessage(error), "error");
    }
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ListMusic}
        title="Nenhuma música neste repertório"
        description="Busque no catálogo ou escolha uma das suas músicas, logo abaixo."
      />
    );
  }

  return (
    <>
      <ol ref={listRef} className="divide-y rounded-2xl border bg-card">
        {entries.map((entry, index) => {
          const label = getSongLabel(entry);
          const isEditing = editingItemId === entry.item.id;
          return (
            <RepertoireEntryRow
              key={entry.item.id}
              repertoireId={repertoireId}
              entry={entry}
              number={index + 1}
              details={
                isEditing && (
                  <RepertoireItemEditor
                    repertoireId={repertoireId}
                    revision={revision}
                    entry={entry}
                    showMoment={forMass || entry.item.moment !== undefined}
                    onClose={() => setEditingItemId(null)}
                  />
                )
              }
              controls={
                <MoreActionsMenu iconOnly label={`Mais ações de ${label}`}>
                  <Button
                    variant="ghost"
                    size="lg"
                    className={MENU_ITEM_CLASS}
                    aria-label={`Ajustar tom e anotações de ${label}`}
                    aria-expanded={isEditing}
                    onClick={() => setEditingItemId(isEditing ? null : entry.item.id)}
                  >
                    <SlidersHorizontal aria-hidden />Tom e anotações
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    className={MENU_ITEM_CLASS}
                    data-move="up"
                    disabled={index === 0}
                    aria-label={`Mover ${label} para cima`}
                    onClick={() => handleMove(entry, "up")}
                  >
                    <ArrowUp aria-hidden />Mover para cima
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    className={MENU_ITEM_CLASS}
                    data-move="down"
                    disabled={index === entries.length - 1}
                    aria-label={`Mover ${label} para baixo`}
                    onClick={() => handleMove(entry, "down")}
                  >
                    <ArrowDown aria-hidden />Mover para baixo
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    className={MENU_ITEM_CLASS}
                    data-remove
                    aria-label={`Remover ${label} do repertório`}
                    onClick={() => handleRemove(entry)}
                  >
                    <X aria-hidden />Remover do repertório
                  </Button>
                </MoreActionsMenu>
              }
            />
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}
