import { cn } from "cn";

import {
  groupSegmentsIntoWords,
  parseChordPro,
  type ChordProLine,
  type ChordProSection,
  type LyricsLine,
} from "../services/chordpro-parser";
import type { ReadingMode } from "../domain/reader-preferences";
import { extractLyrics, hasLyrics, type LyricsSection } from "../services/chordpro-lyrics";
import { transposeParsedChordPro } from "../services/chordpro-transposition";

function LyricsRow({ line }: { line: LyricsLine }) {
  const words = groupSegmentsIntoWords(line.segments);

  return (
    <p className="flex flex-wrap">
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-flex">
          {word.map((segment, segmentIndex) => {
            // A folga só é necessária para o acorde não encostar no acorde seguinte.
            const nextPiece = word[segmentIndex + 1] ?? words[wordIndex + 1]?.[0];

            return (
              <span key={segmentIndex} className="inline-flex flex-col">
                {line.hasChords && (
                  <span
                    data-chord
                    className={cn(
                      "min-h-[1.5em] font-mono text-[0.9em] leading-[1.5] font-semibold whitespace-pre text-chord",
                      nextPiece?.chord && "pr-[0.5ch]",
                      !line.hasLyrics && "pr-[1.5ch]",
                    )}
                  >
                    {segment.chord}
                  </span>
                )}
                {line.hasLyrics && (
                  <span className="whitespace-pre">{segment.text || " "}</span>
                )}
              </span>
            );
          })}
        </span>
      ))}
    </p>
  );
}

function SheetLine({ line }: { line: ChordProLine }) {
  if (line.kind === "comment") {
    return <p className="text-[0.8em] font-medium text-muted-foreground">{line.text}</p>;
  }
  return <LyricsRow line={line} />;
}

function ChorusLabel() {
  return (
    <h2 data-sheet-label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      Refrão
    </h2>
  );
}

function SheetSection({ section }: { section: ChordProSection }) {
  const isChorus = section.kind === "chorus";

  return (
    <section data-stanza className={cn("space-y-2", isChorus && "border-l-2 border-chord/50 pl-4")}>
      {isChorus && <ChorusLabel />}
      {section.lines.map((line, index) => (
        <SheetLine key={index} line={line} />
      ))}
    </section>
  );
}

/** Estrofe só com a letra: mesmas seções e o mesmo destaque do refrão, sem acordes. */
function LyricsStanza({ section }: { section: LyricsSection }) {
  const isChorus = section.kind === "chorus";

  return (
    <section data-stanza className={cn("space-y-0.5", isChorus && "border-l-2 border-chord/50 pl-4")}>
      {isChorus && <ChorusLabel />}
      {section.lines.map((line, index) =>
        line.kind === "comment" ? (
          <p key={index} className="text-[0.8em] font-medium text-muted-foreground italic">
            {line.text}
          </p>
        ) : (
          <p key={index} className="whitespace-pre-wrap">
            {line.text}
          </p>
        ),
      )}
    </section>
  );
}

interface ChordSheetProps {
  source: string;
  /** Deslocamento aplicado somente à exibição; o texto original não é alterado. */
  semitones?: number;
  /** Tamanho base em pixels. Acordes e letras escalam juntos, pois usam medidas relativas. */
  fontSize?: number;
  /** `lyrics` mostra só a letra, interpretando o mesmo ChordPro; a cifra guardada não muda. */
  mode?: ReadingMode;
  className?: string;
}

export const NO_LYRICS_MESSAGE = "Esta cifra não tem letra para mostrar: só acordes.";

export function ChordSheet({ source, semitones = 0, fontSize, mode = "chords", className }: ChordSheetProps) {
  const parsed = parseChordPro(source);
  const lyrics = mode === "lyrics" ? extractLyrics(parsed) : null;
  const { sections } = mode === "chords" ? transposeParsedChordPro(parsed, semitones) : { sections: [] };

  return (
    <div
      data-reading-mode={mode}
      className={cn(
        mode === "chords" ? "space-y-7 leading-relaxed" : "space-y-5 leading-normal",
        fontSize === undefined && "text-[1.0625rem] md:text-lg",
        className,
      )}
      style={fontSize === undefined ? undefined : { fontSize: `${fontSize}px` }}
    >
      {lyrics ? (
        hasLyrics(lyrics) ? (
          lyrics.sections.map((section, index) => <LyricsStanza key={index} section={section} />)
        ) : (
          <p className="text-[0.85em] text-muted-foreground">{NO_LYRICS_MESSAGE}</p>
        )
      ) : (
        sections.map((section, index) => <SheetSection key={index} section={section} />)
      )}
    </div>
  );
}
