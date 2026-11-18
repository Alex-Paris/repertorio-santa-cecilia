import { z } from "zod";

export const MIN_FONT_SIZE = 14;
export const MAX_FONT_SIZE = 30;
export const FONT_SIZE_STEP = 2;
export const DEFAULT_FONT_SIZE = 18;

export const MIN_SCROLL_SPEED = 10;
export const MAX_SCROLL_SPEED = 80;
export const SCROLL_SPEED_STEP = 5;
export const DEFAULT_SCROLL_SPEED = 30;

/** Cifra (letra com acordes) ou só a letra. A cifra armazenada nunca muda. */
export const READING_MODES = ["chords", "lyrics"] as const;
export type ReadingMode = (typeof READING_MODES)[number];

export const READING_MODE_LABELS: Record<ReadingMode, string> = { chords: "Cifra", lyrics: "Letra" };

/** Fundo do modo apresentação: claro (pergaminho) por padrão, escuro por escolha. */
export const PRESENTATION_THEMES = ["light", "dark"] as const;
export type PresentationTheme = (typeof PRESENTATION_THEMES)[number];

export interface ReaderPreferences {
  /** Tamanho base da cifra, em pixels. */
  fontSize: number;
  /** Velocidade da rolagem automática, em pixels por segundo. */
  scrollSpeed: number;
  /** Modo de leitura, o mesmo no leitor e na apresentação. */
  readingMode: ReadingMode;
  presentationTheme: PresentationTheme;
}

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  fontSize: DEFAULT_FONT_SIZE,
  scrollSpeed: DEFAULT_SCROLL_SPEED,
  readingMode: "chords",
  presentationTheme: "light",
};

const readerPreferencesSchema: z.ZodType<ReaderPreferences> = z.object({
  fontSize: z
    .number()
    .int()
    .min(MIN_FONT_SIZE)
    .max(MAX_FONT_SIZE)
    .multipleOf(FONT_SIZE_STEP)
    .catch(DEFAULT_FONT_SIZE),
  scrollSpeed: z
    .number()
    .int()
    .min(MIN_SCROLL_SPEED)
    .max(MAX_SCROLL_SPEED)
    .multipleOf(SCROLL_SPEED_STEP)
    .catch(DEFAULT_SCROLL_SPEED),
  // Preferências antigas não têm estes campos: valem os padrões.
  readingMode: z.enum(READING_MODES).catch("chords"),
  presentationTheme: z.enum(PRESENTATION_THEMES).catch("light"),
});

/** Valida dados não confiáveis; cada campo inválido volta individualmente ao padrão. */
export function parseReaderPreferences(value: unknown): ReaderPreferences {
  const result = readerPreferencesSchema.safeParse(value);
  return result.success ? result.data : DEFAULT_READER_PREFERENCES;
}

export function clampFontSize(value: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value));
}

export function clampScrollSpeed(value: number): number {
  return Math.min(MAX_SCROLL_SPEED, Math.max(MIN_SCROLL_SPEED, value));
}
