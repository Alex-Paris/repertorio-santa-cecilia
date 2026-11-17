"use client";

import { cn } from "cn";
import { ExternalLink, Film, PlayCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { parseYouTubeId, youTubeEmbedUrl, youTubeWatchUrl } from "../domain/video-reference";

interface VideoReferenceProps {
  /** Identificador do vídeo aprovado no catálogo (Etapa 2F.1). */
  videoId?: string | null;
  /** Endereço comum do YouTube, quando o identificador não está à mão. */
  url?: string | null;
  /** Título da música, para o nome acessível do player. */
  title: string;
  /** Título do vídeo informado na contribuição, se houver. */
  videoTitle?: string;
  className?: string;
}

/**
 * Referência em vídeo, ao lado do título da cifra. Sem endereço válido, é só uma indicação de
 * uma linha: nada de miniatura nem botão de tocar falso. Com endereço, abre um painel
 * flutuante, que não tira a cifra da área principal; o player do YouTube (sem cookies) só é
 * carregado quando a pessoa pede, e nunca toca sozinho.
 */
export function VideoReference({ videoId, url, title, videoTitle, className }: VideoReferenceProps) {
  // O identificador passa pela mesma validação de um endereço: nada fora do padrão chega ao iframe.
  const id = videoId ? parseYouTubeId(youTubeWatchUrl(videoId)) : parseYouTubeId(url);
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
          {videoTitle && <p className="text-sm wrap-break-word">{videoTitle}</p>}
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
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-auto min-h-10 max-w-full py-2 text-left whitespace-normal"
                onClick={() => setLoaded(true)}
              >
                <PlayCircle data-icon="inline-start" aria-hidden />
                Carregar vídeo de {title}
              </Button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <p>Se o vídeo tiver sido removido, o YouTube mostra um aviso no lugar dele.</p>
            <a
              href={youTubeWatchUrl(id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline underline-offset-3"
            >
              Abrir no YouTube
              <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">(abre em outra aba)</span>
            </a>
          </div>
        </aside>
      )}
    </>
  );
}
