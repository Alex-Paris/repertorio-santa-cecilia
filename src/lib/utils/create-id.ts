/**
 * Gera um ID único e estável. `randomUUID` só existe em contextos seguros,
 * então acessos por IP local em HTTP, como testes no celular, usam o fallback.
 */
export function createId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
