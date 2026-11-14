import type { MusicalKey } from "./musical-key";

export const MIN_TRANSPOSE_SEMITONES = -11;
export const MAX_TRANSPOSE_SEMITONES = 11;

/** Grafia usada quando o resultado cai em uma nota com acidente. */
export type AccidentalPreference = "sharp" | "flat";

const SEMITONES_IN_OCTAVE = 12;
const MAX_CHORD_LENGTH = 32;

const NOTE_NAMES: Record<AccidentalPreference, readonly string[]> = {
  sharp: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
  flat: ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"],
};

const NATURAL_PITCHES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const NOTE = "[A-G][#b]?";
const INTERVAL = "(?:13|11|9|7|6|5|4|2)";
const MODIFIER = `(?:[Mm]aj${INTERVAL}?|M${INTERVAL}?|sus[24]?|add[#b]?${INTERVAL}|omit[35]|no[35]|alt|[#b+-]${INTERVAL}|${INTERVAL})`;
const GROUP = `\\(${MODIFIER}(?:[,/]${MODIFIER})*\\)`;
const QUALITY = "(?:[Mm]aj|min|mi|m|M|dim|aug|°|º|ø|Δ|\\+|-)?";
const SUFFIX = `${QUALITY}(?:${MODIFIER}|${GROUP}|/${INTERVAL}|\\+|-)*`;

/**
 * Fundamental, sufixo validado e baixo opcional. Validar o sufixo inteiro impede
 * que textos como "Bridge" ou "Coda" sejam tratados como acordes de B ou C.
 */
const CHORD_PATTERN = new RegExp(`^(${NOTE})(${SUFFIX})(?:/(${NOTE}))?$`);
const NOTE_PATTERN = new RegExp(`^${NOTE}$`);

function normalizeSemitones(semitones: number): number {
  return ((semitones % SEMITONES_IN_OCTAVE) + SEMITONES_IN_OCTAVE) % SEMITONES_IN_OCTAVE;
}

/** Sem deslocamento efetivo, a grafia original precisa ser mantida. */
function keepsOriginalSpelling(semitones: number): boolean {
  return !Number.isInteger(semitones) || normalizeSemitones(semitones) === 0;
}

function getPitch(note: string): number {
  const accidental = note[1] === "#" ? 1 : note[1] === "b" ? -1 : 0;
  return normalizeSemitones(NATURAL_PITCHES[note[0]] + accidental);
}

function shiftNote(
  note: string,
  semitones: number,
  preference: AccidentalPreference,
): string {
  return NOTE_NAMES[preference][normalizeSemitones(getPitch(note) + semitones)];
}

/** Subindo, prefere sustenidos; descendo, bemóis. */
export function getDefaultAccidentalPreference(semitones: number): AccidentalPreference {
  return semitones < 0 ? "flat" : "sharp";
}

/** Limita um valor à faixa permitida nos controles de tom. */
export function clampTransposeSemitones(semitones: number): number {
  return Math.min(MAX_TRANSPOSE_SEMITONES, Math.max(MIN_TRANSPOSE_SEMITONES, semitones));
}

export function formatSemitoneOffset(semitones: number): string {
  return semitones > 0 ? `+${semitones}` : String(semitones);
}

/** Transpõe uma nota isolada. Texto que não é nota é devolvido sem alteração. */
export function transposeNote(
  note: string,
  semitones: number,
  preference: AccidentalPreference = getDefaultAccidentalPreference(semitones),
): string {
  if (keepsOriginalSpelling(semitones) || !NOTE_PATTERN.test(note)) {
    return note;
  }
  return shiftNote(note, semitones, preference);
}

/**
 * Transpõe a fundamental e o baixo, preservando o sufixo. Marcações que não
 * forem reconhecidas como acordes, como "N.C." ou "%", são devolvidas intactas.
 */
export function transposeChord(
  chord: string,
  semitones: number,
  preference: AccidentalPreference = getDefaultAccidentalPreference(semitones),
): string {
  if (keepsOriginalSpelling(semitones) || chord.length > MAX_CHORD_LENGTH) {
    return chord;
  }

  const match = chord.match(CHORD_PATTERN);
  if (!match) {
    return chord;
  }

  const [, root, suffix, bass] = match;
  const transposedBass = bass ? `/${shiftNote(bass, semitones, preference)}` : "";
  return `${shiftNote(root, semitones, preference)}${suffix}${transposedBass}`;
}

/** Nome do tom exibido, derivado do tom original com a mesma grafia dos acordes. */
export function transposeKey(
  key: MusicalKey,
  semitones: number,
  preference: AccidentalPreference = getDefaultAccidentalPreference(semitones),
): string {
  return transposeChord(key, semitones, preference);
}
