"use client";

import { cn } from "cn";
import { Film, PlayCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { parseYouTubeId, youTubeEmbedUrl } from "../domain/video-reference";

interface VideoReferenceProps {
  /** Endereço de referência autorizado; o catálogo ainda não guarda nenhum. */
  url?: string | null;
  title: string;
  className?: string;
}

/**
 * Espaço da referência em vídeo, perto da cifra. Sem endereço válido, só informa que ainda
 * não há vídeo: nenhuma miniatura nem botão de reprodução falso. Com endereço, o player do
 * YouTube (sem cookies) só é carregado quando a pessoa pede, e nunca toca sozinho.
 */
export function VideoReference({ url, title, className }: VideoReferenceProps) {
  const id = parseYouTubeId(url);
  const [loaded, setLoaded] = useState(false);

  return (
    <section aria-labelledby="referencias-em-video" className={cn("rounded-2xl border bg-card/70 p-4", className)}>
      <h3 id="referencias-em-video" className="flex items-center gap-2 font-display text-lg font-semibold text-heading">
        <Film className="size-5 text-gold" aria-hidden />
        Referências em vídeo
      </h3>
      {!id ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Ainda não há vídeo de referência para esta música. Quando houver um link autorizado, ele aparecerá aqui, sem
          reprodução automática.
        </p>
      ) : loaded ? (
        <div className="mt-3 aspect-video overflow-hidden rounded-xl border bg-black">
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
        <div className="mt-2 space-y-2">
          <p className="text-sm text-muted-foreground">
            O vídeo vem do YouTube, no modo de privacidade aprimorada, e só é carregado quando você pedir.
          </p>
          <Button type="button" variant="outline" size="lg" onClick={() => setLoaded(true)}>
            <PlayCircle data-icon="inline-start" aria-hidden />
            Carregar vídeo de {title}
          </Button>
        </div>
      )}
    </section>
  );
}
