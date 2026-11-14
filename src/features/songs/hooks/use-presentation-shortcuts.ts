"use client";

import { useEffect, useRef } from "react";

export interface PresentationShortcuts {
  onToggleScroll?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onExit: () => void;
}

function isEditable(target: Element): boolean {
  return target.closest("input, textarea, select, [contenteditable='true']") !== null;
}

/** Nestes elementos, a barra de espaço já tem uma função nativa. */
function usesSpaceNatively(target: Element): boolean {
  return target.closest("button, a[href], summary, [role='button']") !== null;
}

/** Atalhos do modo apresentação, com um único listener enquanto o modo estiver ativo. */
export function usePresentationShortcuts(shortcuts: PresentationShortcuts): void {
  const latest = useRef(shortcuts);

  useEffect(() => {
    latest.current = shortcuts;
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target instanceof Element ? event.target : document.body;
      if (isEditable(target)) {
        return;
      }

      const { onToggleScroll, onNext, onPrevious, onExit } = latest.current;

      switch (event.key) {
        case " ":
          if (!usesSpaceNatively(target) && onToggleScroll) {
            event.preventDefault();
            if (!event.repeat) {
              onToggleScroll();
            }
          }
          break;
        case "ArrowRight":
          if (onNext) {
            event.preventDefault();
            onNext();
          }
          break;
        case "ArrowLeft":
          if (onPrevious) {
            event.preventDefault();
            onPrevious();
          }
          break;
        case "Escape":
          event.preventDefault();
          onExit();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
