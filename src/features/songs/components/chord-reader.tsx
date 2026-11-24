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
        className="sticky top-14 z-10 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card/95 px-3 py-2 backdrop-blur md:top-16 lg:top-[4.6rem] [@media(max-height:520px)]:top-0">
        <ReadingModeToggle compact />
        {readingMode === "chords" && <TransposeControls originalKey={originalKey} semitones={semitones} onChange={onSemitonesChange} hint={adjustmentHint} compact />}
        <FontSizeControls fontSize={fontSize} compact />
      </div>
      <article className="overflow-x-auto rounded-xl border bg-card p-5 md:p-8">
        <ChordSheet source={chordPro} semitones={semitones} fontSize={fontSize} mode={readingMode} />
      </article>
    </>
  );
}
