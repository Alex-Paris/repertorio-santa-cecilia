"use client";

import { Film } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";

import { FormError } from "@/components/layout/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLibraryErrorMessage, LibraryError } from "@/features/library/domain/library-errors";
import { youTubeWatchUrl } from "@/features/songs/domain/video-reference";
import { showToast } from "@/lib/utils/toast";

import { createCatalogAdminApi } from "../data/catalog-admin-api";
import type { CatalogSong } from "../domain/catalog-song";
import { catalogVideoInputSchema, type CatalogVideoInput } from "../domain/catalog-video";

type VideoSong = Pick<CatalogSong, "id" | "revision" | "video">;

/** Só é oferecido à administração; a API confere sessão, papel e revisão novamente. */
export function CatalogVideoEditor({ userId, song: initialSong }: { userId: string; song: VideoSong }) {
  const router = useRouter();
  const panelId = useId();
  const errorId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [savedSong, setSong] = useState(initialSong);
  const song = savedSong.revision > initialSong.revision ? savedSong : initialSong;
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(song.video ? youTubeWatchUrl(song.video.videoId) : "");
  const [title, setTitle] = useState(song.video?.title ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setError(null);
    buttonRef.current?.focus();
  }

  async function save(video: CatalogVideoInput | null) {
    setError(null);
    setPending(true);
    try {
      const updated = await createCatalogAdminApi(userId).updateVideo(song.id, video, song.revision);
      setSong(updated);
      setUrl(updated.video ? youTubeWatchUrl(updated.video.videoId) : "");
      setTitle(updated.video?.title ?? "");
      close();
      requestAnimationFrame(() => buttonRef.current?.focus());
      showToast(video ? "Vídeo de referência salvo." : "Vídeo de referência removido.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof LibraryError && caught.code === "revision-conflict"
        ? "Esta música foi alterada. Recarregue a página antes de salvar o vídeo."
        : getLibraryErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = catalogVideoInputSchema.safeParse({ url, ...(title.trim() ? { title } : {}) });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os dados do vídeo.");
      return;
    }
    void save(parsed.data);
  }

  return (
    <div>
      <Button
        ref={buttonRef}
        type="button"
        size="sm"
        variant="outline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (open) return close();
          setUrl(song.video ? youTubeWatchUrl(song.video.videoId) : "");
          setTitle(song.video?.title ?? "");
          setOpen(true);
        }}
        disabled={pending}
      >
        <Film data-icon="inline-start" aria-hidden />
        {song.video ? "Editar vídeo" : "Adicionar vídeo do YouTube"}
      </Button>
      {open && (
        <form id={panelId} aria-label="Vídeo do YouTube" aria-busy={pending} onSubmit={submit} noValidate className="mt-3 space-y-3 rounded-xl border bg-background/50 p-3 sm:p-4">
          <label className="block space-y-1 text-sm font-medium">
            Link do YouTube
            <Input type="url" autoFocus maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} disabled={pending} aria-describedby={error ? errorId : undefined} />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Título do vídeo (opcional)
            <Input maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} disabled={pending} />
          </label>
          <p className="text-xs text-muted-foreground">Confira se o vídeo corresponde à música. Ele será exibido como referência no catálogo.</p>
          {error && <div id={errorId}><FormError message={error} /></div>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>{pending ? "Salvando…" : "Salvar vídeo"}</Button>
            <Button type="button" size="sm" variant="outline" onClick={close} disabled={pending}>Cancelar</Button>
            {song.video && <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => void save(null)}>Remover vídeo</Button>}
          </div>
        </form>
      )}
    </div>
  );
}
