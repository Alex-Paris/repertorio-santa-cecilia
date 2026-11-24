const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtube-nocookie.com"]);
export const MAX_VIDEO_START_SECONDS = 7 * 24 * 60 * 60;

export interface YouTubeReference {
  provider: "youtube";
  videoId: string;
  title?: string;
  startSeconds?: number;
}

export function isValidVideoStart(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_VIDEO_START_SECONDS;
}

/**
 * Identificador de um vídeo do YouTube a partir de um endereço comum (watch, youtu.be, embed,
 * shorts). Qualquer outro endereço, protocolo inseguro ou identificador malformado dá `null`:
 * sem link válido, nada de vídeo é mostrado.
 */
export function parseYouTubeId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !YOUTUBE_HOSTS.has(url.hostname)) {
    return null;
  }
  const candidate =
    url.hostname === "youtu.be"
      ? url.pathname.slice(1)
      : url.pathname === "/watch"
        ? url.searchParams.get("v")
        : /^\/(embed|shorts|live)\/([^/]+)/.exec(url.pathname)?.[2];
  return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
}

/** Tempo opcional em links compartilhados: `t=90`, `t=1m30s`, `start=90` ou `#t=90`. */
export function parseYouTubeStartSeconds(value: string | null | undefined): number | null {
  if (!value || !parseYouTubeId(value)) return null;
  const url = new URL(value.trim());
  const raw = (url.searchParams.get("start") ?? url.searchParams.get("t") ?? new URLSearchParams(url.hash.slice(1)).get("t"))?.trim();
  if (!raw) return null;
  let seconds: number;
  if (/^\d+$/.test(raw)) {
    seconds = Number(raw);
  } else {
    const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(raw);
    if (!parts || !parts.slice(1).some(Boolean)) return null;
    seconds = Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0);
  }
  return isValidVideoStart(seconds) ? seconds : null;
}

/** A reprodução automática só é solicitada após a ação explícita de ouvir. */
export function youTubeEmbedUrl(id: string, { startSeconds = 0, autoplay = false }: { startSeconds?: number; autoplay?: boolean } = {}): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0${isValidVideoStart(startSeconds) && startSeconds > 0 ? `&start=${startSeconds}` : ""}${autoplay ? "&autoplay=1&playsinline=1" : ""}`;
}

/** Endereço comum do vídeo, para abrir no próprio YouTube. */
export function youTubeWatchUrl(id: string, startSeconds = 0): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}${isValidVideoStart(startSeconds) && startSeconds > 0 ? `&t=${startSeconds}` : ""}`;
}
