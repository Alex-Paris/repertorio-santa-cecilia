import { celebrationInputSchema, type CelebrationInput } from "../domain/celebration-record";
import raw from "./editorial-celebrations.json";

/**
 * Base editorial inicial (Etapa 2E.2), agora só dados de importação: a fonte em uso é o
 * MongoDB. O arquivo JSON é o mesmo lido por `scripts/import-liturgical-celebrations.mjs`.
 */
export interface EditorialCelebration {
  /** Identificador estável, o mesmo que os repertórios já guardam. */
  id: string;
  input: CelebrationInput;
}

/** Valida cada celebração com as regras do domínio. Um arquivo inválido não é importado. */
export function parseEditorialCelebrations(document: unknown): EditorialCelebration[] {
  const entries = (document as { celebrations?: unknown }).celebrations;
  if (!Array.isArray(entries)) {
    throw new Error("Arquivo de celebrações sem a lista `celebrations`.");
  }
  return entries.map((entry: unknown, index) => {
    const { id, ...input } = entry as { id?: unknown };
    const parsed = celebrationInputSchema.safeParse(input);
    if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !parsed.success) {
      throw new Error(`Celebração ${index + 1} inválida: ${parsed.success ? "identificador" : parsed.error.issues[0]?.message}`);
    }
    return { id, input: parsed.data };
  });
}

export const EDITORIAL_CELEBRATIONS: readonly EditorialCelebration[] = parseEditorialCelebrations(raw);
