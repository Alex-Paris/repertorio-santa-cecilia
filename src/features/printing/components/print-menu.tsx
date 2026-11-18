"use client";

import { cn } from "cn";
import { ChevronDown, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";

interface PrintMenuProps {
  /** Formatos oferecidos, cada um com o endereço da sua pré-visualização. */
  options: { label: string; href: string }[];
  label?: string;
  size?: "sm" | "lg";
  /** Lado em que o menu se alinha ao botão; `end` para botões encostados à direita. */
  align?: "start" | "end";
  className?: string;
}

/**
 * Um botão "Imprimir" discreto com os formatos num menu, em vez de vários botões grandes
 * disputando espaço com a leitura. Fecha com Esc, com um clique fora e ao escolher.
 */
export function PrintMenu({ options, label = "Imprimir", size = "lg", align = "start", className }: PrintMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
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
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={cn(buttonVariants({ variant: "outline", size }), size === "sm" && "h-9 px-3")}
      >
        <Printer data-icon="inline-start" aria-hidden />
        {label}
        <ChevronDown data-icon="inline-end" className="size-3.5" aria-hidden />
      </button>
      {open && (
        <ul
          id={menuId}
          aria-label="Formatos de impressão"
          className={cn("absolute top-full z-30 mt-1 min-w-[12rem]", align === "end" ? "right-0" : "left-0", "rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg")}
        >
          {options.map((option) => (
            <li key={option.href}>
              <Link
                href={option.href}
                onClick={() => setOpen(false)}
                className="flex rounded-lg px-3 py-2 text-sm hover:bg-muted focus-visible:bg-muted"
              >
                {option.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
