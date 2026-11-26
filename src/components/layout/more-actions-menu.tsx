"use client";

import { cn } from "cn";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";

/** Aparência de um item do menu, para links e botões que entram nele. */
export const MENU_ITEM_CLASS =
  "flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground hover:bg-muted focus-visible:bg-muted [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

interface MoreActionsMenuProps {
  children: ReactNode;
  /** Nome acessível do botão; o texto visível é "Mais". */
  label?: string;
  align?: "start" | "end";
  className?: string;
  iconOnly?: boolean;
}

/**
 * Ações secundárias atrás de um botão "Mais", para a ação principal ficar à vista sozinha.
 *
 * É um painel que abre e fecha (não um menu com navegação por setas): os itens são links e
 * botões comuns, na ordem do Tab. O painel continua montado quando fechado, só oculto, porque
 * um item pode abrir um diálogo de confirmação, que precisa do seu botão para existir e para
 * devolver o foco. Fecha com Esc, com um clique fora e ao seguir um link; enquanto um diálogo
 * aberto a partir dele estiver na tela, fica aberto.
 */
export function MoreActionsMenu({ children, label = "Mais ações", align = "end", className, iconOnly = false }: MoreActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialogOpen = () => document.querySelector('[role="alertdialog"]:not([hidden]), [role="dialog"]:not([hidden])') !== null;
    function onPointer(event: PointerEvent): void {
      if (dialogOpen()) return;
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape" && !dialogOpen()) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} data-print-hide className={cn("relative inline-flex", className)}>
      <button
        ref={buttonRef}
        data-more-trigger
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(buttonVariants({ variant: "outline", size: iconOnly ? "icon" : "lg" }))}
      >
        <MoreHorizontal data-icon="inline-start" aria-hidden />
        {!iconOnly && "Mais"}
      </button>
      <div
        id={panelId}
        hidden={!open}
        onClick={(event) => {
          // Seguir um link fecha o painel; um botão que abre diálogo o mantém aberto.
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={cn(
          "absolute top-full z-30 mt-1 min-w-[13rem] rounded-xl border bg-popover p-1 shadow-lg",
          align === "end" ? "right-0" : "left-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}
