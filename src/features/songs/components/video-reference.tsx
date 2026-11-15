"use client";

import { cn } from "cn";
import { Film, PlayCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { parseYouTubeId, youTubeEmbedUrl } from "../domain/video-reference";

interface VideoReferenceProps {
  /** Endereço de referência autorizado; o catálogo ainda não guarda nenhum. */
  url?: string | null;
  title: string;
  className?: string;
}

/**
 * Referência em vídeo, ao lado do título da cifra. Sem endereço válido, é só uma indicação de
 * uma linha: nada de miniatura nem botão de tocar falso. Com endereço, abre um painel
 * flutuante, que não tira a cifra da área principal; o player do YouTube (sem cookies) só é
 * carregado quando a pessoa pede, e nunca toca sozinho.
 */
export function VideoReference({ url, title, className }: VideoReferenceProps) {
  const id = parseYouTubeId(url);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const panelId = useId();
  const headingId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!id) {
    return (
      <p className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Film className="size-3.5" aria-hidden />
        Sem vídeo de referência
      </p>
    );
  }

  return (
    <>
      <Button
        ref={toggleRef}
        type="button"
        variant="outline"
        size="sm"
        className={cn("h-8", className)}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <Film data-icon="inline-start" aria-hidden />
        Referência em vídeo
      </Button>
      {open && (
        <aside
          id={panelId}
          aria-labelledby={headingId}
          className="fixed inset-x-3 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border bg-popover p-3 shadow-2xl md:inset-x-auto md:bottom-4 md:left-4 md:w-[24rem]"
        >
          <div className="flex items-center gap-2">
            <h2 id={headingId} className="flex-1 font-display text-base font-semibold text-heading">
              Referência em vídeo
            </h2>
            <Button
              ref={closeRef}
              type="button"
              variant="ghost"
              size="icon-lg"
              className="size-9"
              aria-label="Fechar referência em vídeo"
              onClick={() => {
                setOpen(false);
                toggleRef.current?.focus();
              }}
            >
              <X aria-hidden />
            </Button>
          </div>
          {loaded ? (
            <div className="mt-2 aspect-video overflow-hidden rounded-xl border bg-black">
              <iframe
                src={youTubeEmbedUrl(id)}
                title={`Referência em vídeo: ${title}`}
                className="size-full"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="encrypted-media; picture-in-picture; fullscreen"
              />
            </div>
          ) : (
            <div className="mt-1 space-y-2">
              <p className="text-sm text-muted-foreground">
                O vídeo vem do YouTube, no modo de privacidade aprimorada, e só é carregado quando você pedir. A cifra
                continua aberta ao lado.
              </p>
              <Button type="button" variant="outline" size="lg" onClick={() => setLoaded(true)}>
                <PlayCircle data-icon="inline-start" aria-hidden />
                Carregar vídeo de {title}
              </Button>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
