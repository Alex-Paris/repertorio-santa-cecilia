/** Mesmos cabeçalhos no proxy (páginas) e na API pública. */
export const PUBLIC_SHARE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
} as const;
