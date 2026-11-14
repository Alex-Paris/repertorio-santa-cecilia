"use client";

import { cn } from "cn";
import { CalendarSearch, ChevronDown, CircleUserRound, Library, Moon, Share2, Sun, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { applyPreferredTheme, toggleTheme } from "@/lib/utils/theme";

const LINKS = [
  { href: "/conta", label: "Minha conta", icon: UserRound },
  { href: "/biblioteca", label: "Minhas músicas", icon: Library },
  { href: "/compartilhamentos", label: "Links compartilhados", icon: Share2 },
  { href: "/celebracoes", label: "Buscar celebrações", icon: CalendarSearch },
];

/**
 * Menu "Conta" do cabeçalho: as páginas da conta que não cabem na navegação principal e a
 * troca de tema. Fecha com Esc, clique fora ou ao escolher um item.
 */
export function AccountMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    applyPreferredTheme();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
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

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-popover-foreground hover:bg-muted focus-visible:bg-muted";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 items-center gap-2 rounded-xl px-2.5 text-header-foreground transition-colors hover:bg-white/10"
      >
        <CircleUserRound className="size-7 stroke-[1.4]" aria-hidden />
        <span className="text-[0.95rem] font-medium">Conta</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute top-full right-0 z-40 mt-2 w-60 rounded-2xl border bg-popover p-1.5 shadow-xl"
        >
          <ul>
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={itemClass} onClick={() => setOpen(false)}>
                  <link.icon className="size-4 text-gold-strong" aria-hidden />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="my-1 h-px bg-border" />
          <button type="button" className={itemClass} onClick={toggleTheme}>
            <Moon className="size-4 text-gold-strong dark:hidden" aria-hidden />
            <Sun className="hidden size-4 text-gold-strong dark:block" aria-hidden />
            <span className="dark:hidden">Usar tema escuro</span>
            <span className="hidden dark:inline">Usar tema claro</span>
          </button>
        </div>
      )}
    </div>
  );
}
