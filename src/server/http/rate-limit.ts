import "server-only";

import { LibraryError } from "@/features/library/domain/library-errors";

const WINDOW_MS = 60_000;
const buckets = new Map<string, { windowStart: number; count: number }>();

/**
 * Limite simples por instância, para a API pública de leitura. Não substitui um limite
 * no proxy reverso: em várias instâncias, cada uma conta separadamente.
 */
export function assertWithinRateLimit(request: Request, scope: string, perMinute: number): void {
  // Atrás de um proxy confiável, o primeiro endereço é o do cliente. Sem ele, um balde comum.
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonimo";
  const key = `${scope}:${client}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { windowStart: now, count: 1 });
    if (buckets.size > 10_000) {
      for (const [entry, value] of buckets) {
        if (now - value.windowStart >= WINDOW_MS) {
          buckets.delete(entry);
        }
      }
    }
    return;
  }

  bucket.count += 1;
  if (bucket.count > perMinute) {
    throw new LibraryError("rate-limited");
  }
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
