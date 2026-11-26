"use client";

import type { MusicalKey } from "../domain/musical-key";
import type { ReadingMode } from "../domain/reader-preferences";
import { ChordSheet } from "./chord-sheet";
import { FontSizeControls, ReadingModeToggle } from "./reader-controls";
import { TransposeControls } from "./transpose-controls";

interface ChordReaderProps {
  chordPro: string;
  originalKey: MusicalKey;
  semitones: number;
  fontSize: number;
  readingMode: ReadingMode;
  adjustmentHint: string;
  onSemitonesChange: (semitones: number) => void;
}

/** A mesma barra de leitura e cifra na biblioteca, no repertório e no link compartilhado. */
export function ChordReader({ chordPro, originalKey, semitones, fontSize, readingMode, adjustmentHint, onSemitonesChange }: ChordReaderProps) {
  return (
    <>
      <div role="group" aria-label="Controles da cifra"
        className="sticky top-16 z-10 mb-6 flex flex-wrap items-center gap-2 border-y bg-background py-3 lg:top-[4.5rem] [@media(max-height:520px)]:top-0">
        <ReadingModeToggle compact />
        {readingMode === "chords" && <TransposeControls originalKey={originalKey} semitones={semitones} onChange={onSemitonesChange} hint={adjustmentHint} compact />}
        <FontSizeControls fontSize={fontSize} compact />
      </div>
      <article className="overflow-x-auto py-4">
        <ChordSheet source={chordPro} semitones={semitones} fontSize={fontSize} mode={readingMode} />
      </article>
    </>
  );
}
