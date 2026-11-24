/** Apenas links públicos de repertório podem solicitar o retorno após autenticação. */
export function parseAuthReturn(value: unknown): string | null {
  return typeof value === "string" && value.length === 69 && /^\/s\/[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function withAuthReturn(path: string, returnTo: string | null): string {
  const safe = parseAuthReturn(returnTo);
  return safe ? `${path}${path.includes("?") ? "&" : "?"}retorno=${encodeURIComponent(safe)}` : path;
}
