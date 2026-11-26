"use client";

import { useEffect, useState } from "react";

/** A navegação cede espaço quando o teclado reduz a área visível de um formulário. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    const update = () => {
      if (active) {
        const field = document.activeElement;
        // Diálogos já isolam o fundo e ajustam sua própria altura; manter o acionador disponível.
        const focused = field?.matches("input:not([type=checkbox]):not([type=radio]), textarea, select") && !field.closest('[role="dialog"], [role="alertdialog"]');
        const visible = window.visualViewport?.height ?? innerHeight;
        setOpen(innerWidth < 1024 && Boolean(focused) && (visible < innerHeight * .78 || innerHeight < 520));
      }
    };
    const afterFocus = () => queueMicrotask(update);
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", afterFocus);
    document.addEventListener("focusout", afterFocus);
    return () => {
      active = false;
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", afterFocus);
      document.removeEventListener("focusout", afterFocus);
    };
  }, []);
  return open;
}
