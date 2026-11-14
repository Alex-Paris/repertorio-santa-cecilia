const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtube-nocookie.com"]);

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

/** Incorporação no modo de privacidade aprimorada, sem reprodução automática. */
export function youTubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
}
