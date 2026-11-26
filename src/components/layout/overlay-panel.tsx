"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactElement, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

/** Um só padrão de foco, Escape, bloqueio do fundo e retorno ao acionador. */
export function OverlayPanel({ open, onOpenChange, title, description, children, trigger, keepMounted = false, finalFocus }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  trigger?: ReactElement;
  keepMounted?: boolean;
  finalFocus?: () => HTMLElement | boolean | null;
}) {
  const popup = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const resize = () => {
      const height = viewport?.height ?? innerHeight;
      popup.current?.style.setProperty("--panel-visible-height", `${height}px`);
      popup.current?.style.setProperty("--panel-bottom-offset", `${Math.max(0, innerHeight - height - (viewport?.offsetTop ?? 0))}px`);
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    return () => { viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize); window.removeEventListener("resize", resize); };
  }, [open]);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger render={trigger} />}
      <Dialog.Portal keepMounted={keepMounted}>
        <Dialog.Backdrop hidden={!open} className="fixed inset-0 z-40 bg-black/40 dark:bg-black/65" data-print-hide />
        <Dialog.Popup ref={popup} hidden={!open} finalFocus={finalFocus} className="overlay-panel" data-print-hide>
          <header className="mb-6 flex items-start justify-between gap-3">
            <div className="min-w-0"><Dialog.Title className="text-2xl font-semibold tracking-tight">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-2 text-sm text-muted-foreground">{description}</Dialog.Description>}
            </div>
            <Dialog.Close render={<Button variant="ghost" size="icon" aria-label="Fechar painel" />}><X aria-hidden /></Dialog.Close>
          </header>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
