import { normalizeText } from "@/lib/utils/normalize-text";

const MAX_TOKENS = 12;

/** Palavras normalizadas: sem acentos, minúsculas, sem pontuação. */
export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Palavras do título e do artista que a busca consegue encontrar pelo começo. */
export function buildSearchTokens(title: string, artist: string): string[] {
  return [...new Set([...tokenize(title), ...tokenize(artist)])];
}

/** Termos da consulta, já normalizados. Consulta vazia lista o catálogo. */
export function parseSearchQuery(query: string): string[] {
  return [...new Set(tokenize(query))].slice(0, MAX_TOKENS);
}

export function buildSortTitle(title: string): string {
  return normalizeText(title).replace(/\s+/g, " ");
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
