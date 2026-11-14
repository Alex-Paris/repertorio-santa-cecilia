/** Limite do arquivo de backup (5 MB), mais uma folga para o envelope da requisição. */
export const MAX_IMPORT_BODY_BYTES = 5 * 1024 * 1024 + 16 * 1024;

/** Compartilhado para o navegador recusar antes de enviar; o servidor sempre revalida. */
export const IMPORT_LIMITS = { songs: 5000, repertoires: 1000, items: 20_000 } as const;
