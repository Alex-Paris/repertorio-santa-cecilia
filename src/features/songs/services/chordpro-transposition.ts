import {
  transposeChord,
  type AccidentalPreference,
} from "../domain/transposition";
import type { ChordProLine, ParsedChordPro } from "./chordpro-parser";

function transposeLine(
  line: ChordProLine,
  semitones: number,
  preference?: AccidentalPreference,
): ChordProLine {
  if (line.kind !== "lyrics") {
    return line;
  }

  return {
    ...line,
    segments: line.segments.map((segment) => ({
      ...segment,
      chord: segment.chord && transposeChord(segment.chord, semitones, preference),
    })),
  };
}

/**
 * Transpõe o modelo já interpretado, alterando apenas os acordes. Trabalhar sobre
 * os trechos do parser mantém letra, quebras de linha e associação acorde/sílaba.
 */
export function transposeParsedChordPro(
  parsed: ParsedChordPro,
  semitones: number,
  preference?: AccidentalPreference,
): ParsedChordPro {
  return {
    ...parsed,
    sections: parsed.sections.map((section) => ({
      ...section,
      lines: section.lines.map((line) => transposeLine(line, semitones, preference)),
    })),
  };
}
