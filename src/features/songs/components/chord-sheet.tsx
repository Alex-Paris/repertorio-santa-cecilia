import { cn } from "cn";

import {
  groupSegmentsIntoWords,
  parseChordPro,
  type ChordProLine,
  type ChordProSection,
  type LyricsLine,
} from "../services/chordpro-parser";
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

function SheetSection({ section }: { section: ChordProSection }) {
  const isChorus = section.kind === "chorus";

  return (
    <section className={cn("space-y-2", isChorus && "border-l-2 border-chord/50 pl-4")}>
      {isChorus && (
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Refrão
        </h2>
      )}
      {section.lines.map((line, index) => (
        <SheetLine key={index} line={line} />
      ))}
    </section>
  );
}

interface ChordSheetProps {
  source: string;
  /** Deslocamento aplicado somente à exibição; o texto original não é alterado. */
  semitones?: number;
  /** Tamanho base em pixels. Acordes e letras escalam juntos, pois usam medidas relativas. */
  fontSize?: number;
}

export function ChordSheet({ source, semitones = 0, fontSize }: ChordSheetProps) {
  const { sections } = transposeParsedChordPro(parseChordPro(source), semitones);

  return (
    <div
      className={cn(
        "space-y-7 leading-relaxed",
        fontSize === undefined && "text-[1.0625rem] md:text-lg",
      )}
      style={fontSize === undefined ? undefined : { fontSize: `${fontSize}px` }}
    >
      {sections.map((section, index) => (
        <SheetSection key={index} section={section} />
      ))}
    </div>
  );
}
