"use client";

import { cn } from "cn";
import { ExternalLink, Film, Play, PlayCircle, Square, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

import { isValidVideoStart, parseYouTubeId, parseYouTubeStartSeconds, youTubeEmbedUrl, youTubeWatchUrl } from "../domain/video-reference";
import { videoPreview } from "../data/video-preview";

interface VideoReferenceProps {
  /** Identificador do vídeo aprovado no catálogo (Etapa 2F.1). */
  videoId?: string | null;
  /** Endereço comum do YouTube, quando o identificador não está à mão. */
  url?: string | null;
  /** Título da música, para o nome acessível do player. */
  title: string;
  /** Título do vídeo informado na contribuição, se houver. */
  videoTitle?: string;
  startSeconds?: number;
  /** Cartões: um clique abre o player e solicita reprodução com som. */
  variant?: "reference" | "play";
  className?: string;
}

/**
 * Referência em vídeo, ao lado do título da cifra. Sem endereço válido, é só uma indicação de
 * uma linha: nada de miniatura nem botão de tocar falso. Com endereço, abre um painel
 * flutuante, que não tira a cifra da área principal; o player do YouTube (sem cookies) só é
 * carregado quando a pessoa pede. No cartão, o clique em ouvir também solicita reprodução.
 */
export function VideoReference({ videoId, url, title, videoTitle, startSeconds, variant = "reference", className }: VideoReferenceProps) {
  // O identificador passa pela mesma validação de um endereço: nada fora do padrão chega ao iframe.
  const id = videoId ? parseYouTubeId(youTubeWatchUrl(videoId)) : parseYouTubeId(url);
  const seconds = startSeconds ?? parseYouTubeStartSeconds(url) ?? 0;
  const start = isValidVideoStart(seconds) ? seconds : 0;
  const ownerId = useId();
  const snapshot = useSyncExternalStore(videoPreview.subscribe, videoPreview.getSnapshot, videoPreview.getServerSnapshot);
  const active = snapshot?.ownerId === ownerId ? snapshot : null;
  const open = active !== null;
  const frameSrc = active?.loaded ? youTubeEmbedUrl(active.videoId, { startSeconds: active.startSeconds, autoplay: active.autoplay }) : undefined;
  const panelId = useId();
  const headingId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const attachFrame = useCallback((node: HTMLIFrameElement | null) => {
    frameRef.current = node;
    if (node && frameSrc) {
      // Restaura também após a reativação de uma tela ou o replay de refs no Strict Mode.
      if (node.getAttribute("src") !== frameSrc) node.setAttribute("src", frameSrc);
      return () => { node.setAttribute("src", "about:blank"); };
    }
  }, [frameSrc]);

  useEffect(() => () => {
    // O Next pode conservar telas ocultas. Interrompe a mídia também ao desativar a tela.
    frameRef.current?.setAttribute("src", "about:blank");
    videoPreview.stop(ownerId);
  }, [ownerId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        videoPreview.stop(ownerId);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const onHidden = () => { if (document.hidden) videoPreview.stop(ownerId); };
    const onPageHide = () => videoPreview.stop(ownerId);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [open, ownerId]);

  if (!id) {
    if (variant === "play") return null;
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
        size={variant === "play" ? "icon-lg" : "sm"}
        className={cn(variant === "play" ? "rounded-full text-primary" : "h-8", className)}
        aria-label={variant === "play" ? `${open ? "Parar" : "Ouvir"} ${title}` : undefined}
        title={variant === "play" ? `${open ? "Parar" : "Ouvir"} ${title}` : undefined}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (open) videoPreview.stop(ownerId);
          else videoPreview.open({ ownerId, videoId: id, startSeconds: start, loaded: variant === "play", autoplay: variant === "play" });
        }}
      >
        {variant === "play"
          ? open ? <Square className="size-4 fill-current" aria-hidden /> : <Play className="size-4 fill-current" aria-hidden />
          : <><Film data-icon="inline-start" aria-hidden />Referência em vídeo</>}
      </Button>
      {open && createPortal(
        <aside
          data-app-chrome data-print-hide
          id={panelId}
          aria-labelledby={headingId}
          className="fixed inset-x-3 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-50 max-h-[calc(100dvh-11rem)] overflow-y-auto rounded-2xl border bg-popover p-3 shadow-2xl md:inset-x-auto md:bottom-4 md:right-4 md:w-[26rem] md:max-h-[calc(100dvh-2rem)] [@media(max-height:520px)]:bottom-2 [@media(max-height:520px)]:max-h-[calc(100dvh-1rem)]"
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
                videoPreview.stop(ownerId);
                toggleRef.current?.focus();
              }}
            >
              <X aria-hidden />
            </Button>
          </div>
          <p className="mt-0.5 text-sm font-medium wrap-break-word">{title}</p>
          {videoTitle && videoTitle !== title && <p className="text-xs text-muted-foreground wrap-break-word">{videoTitle}</p>}
          {active.loaded ? (
            <div className="relative mt-2 aspect-video min-h-[202px] w-full overflow-hidden rounded-xl border bg-black">
              <iframe
                ref={attachFrame}
                src={frameSrc}
                title={`Referência em vídeo: ${title}`}
                className="absolute inset-0 size-full"
                loading={active.autoplay ? "eager" : "lazy"}
                referrerPolicy="strict-origin-when-cross-origin"
                allow={`${active.autoplay ? "autoplay; " : ""}encrypted-media; picture-in-picture; fullscreen`}
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
                onClick={() => videoPreview.load(ownerId)}
              >
                <PlayCircle data-icon="inline-start" aria-hidden />
                Carregar vídeo de {title}
              </Button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <p>{active.startSeconds > 0 ? `Início em ${active.startSeconds} s` : "YouTube"}</p>
            <a
              href={youTubeWatchUrl(active.videoId, active.startSeconds)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline underline-offset-3"
            >
              Abrir no YouTube
              <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">(abre em outra aba)</span>
            </a>
          </div>
          {active.autoplay && <p className="mt-2 text-xs text-muted-foreground">Se o som não iniciar, toque em reproduzir no vídeo.</p>}
        </aside>, document.body,
      )}
    </>
  );
}
