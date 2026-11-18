import { cn } from "cn";

import { ChordSheet } from "@/features/songs/components/chord-sheet";

import { itemHeading, UNAVAILABLE_TEXT, type PrintFormat, type PrintItem } from "../domain/print-model";

interface PrintDocumentProps {
  format: PrintFormat;
  items: readonly PrintItem[];
  /** Música individual: sem momento nem numeração. */
  single?: boolean;
  /** Repertório: nome e linhas de apoio (celebração, data) no alto da primeira folha. */
  header?: { title: string; lines?: string[] };
  className?: string;
}

function Unavailable({ item }: { item: PrintItem }) {
  return (
    <p data-print-unavailable className="mt-1 border-l-2 border-[#9a9a9a] pl-3 text-[0.85em] text-[#474747] italic">
      {item.unavailable ? UNAVAILABLE_TEXT[item.unavailable] : null}
    </p>
  );
}

function SongBody({ item, format }: { item: PrintItem; format: PrintFormat }) {
  if (!item.chordPro) return <Unavailable item={item} />;
  return (
    <ChordSheet
      source={item.chordPro}
      semitones={format === "chords" ? item.semitones : 0}
      mode={format}
      className="print-sheet mt-2"
    />
  );
}

/** Autoria e tom numa linha: "Autora · Tom: G". */
function details(item: PrintItem, format: PrintFormat): string {
  return [item.artist, format === "chords" && item.printKey ? `Tom: ${item.printKey}` : ""].filter(Boolean).join(" · ");
}

/**
 * A folha impressa, também mostrada na pré-visualização. Usa o mesmo `ChordSheet` do leitor e da
 * apresentação: a letra e a cifra têm uma só interpretação do ChordPro.
 *
 * Paginação: no repertório só com letras, as músicas seguem uma depois da outra, com o título
 * preso ao começo da letra; no repertório com cifras, cada música a partir da segunda começa numa
 * nova folha e pode continuar por quantas folhas precisar.
 */
export function PrintDocument({ format, items, single = false, header, className }: PrintDocumentProps) {
  return (
    <article
      data-print-root
      data-print-format={format}
      className={cn("print-paper mx-auto max-w-[52rem] rounded-sm border border-[#ddd] px-6 py-8 shadow-md sm:px-12 sm:py-12", className)}
    >
      {header && (
        <header className="mb-5 border-b border-[#c9c9c9] pb-3">
          <h1 className="text-[1.45em] leading-tight font-semibold text-[#111]">{header.title}</h1>
          {header.lines?.filter(Boolean).map((line) => (
            <p key={line} className="text-[0.9em] text-[#474747]">
              {line}
            </p>
          ))}
        </header>
      )}

      {/*
        Resumo (Etapa 2F.2B), só no repertório somente letras: a ordem da celebração numa lista,
        "Momento: Título", antes das letras completas. As cifras continuam como antes.
      */}
      {format === "lyrics" && !single && items.length > 0 && (
        <section data-print-summary aria-labelledby="resumo-do-repertorio" className="print-summary mb-6 border-b border-[#c9c9c9] pb-4">
          <h2 id="resumo-do-repertorio" className="text-[0.78em] font-semibold tracking-[0.08em] text-[#474747] uppercase">
            Ordem das músicas
          </h2>
          <ol className="mt-1.5 space-y-0.5">
            {items.map((item) => (
              <li key={item.id} className="flex gap-2">
                <span className="w-[1.4em] shrink-0 text-right text-[#474747] tabular-nums">{item.position}.</span>
                <span className="min-w-0">
                  <span className="font-semibold">{item.label}:</span> {item.title}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {items.map((item, index) => (
        <section
          key={item.id}
          data-print-song
          data-position={item.position}
          className={cn("print-song", format === "chords" && index > 0 && "print-page-break")}
        >
          {single ? (
            <div className="print-song-head">
              <h1 className="text-[1.55em] leading-tight font-semibold text-[#111]">{item.title}</h1>
              {details(item, format) && <p className="mt-0.5 text-[0.95em] text-[#474747]">{details(item, format)}</p>}
            </div>
          ) : format === "chords" ? (
            <div className="print-song-head">
              <p className="text-[0.78em] font-semibold tracking-[0.08em] text-[#474747] uppercase">{item.label}</p>
              <h2 className="text-[1.4em] leading-tight font-semibold text-[#111]">{item.title}</h2>
              {details(item, format) && <p className="mt-0.5 text-[0.9em] text-[#474747]">{details(item, format)}</p>}
            </div>
          ) : (
            <h2 className="print-song-head text-[1.08em] leading-snug font-semibold text-[#111]">{itemHeading(item)}</h2>
          )}
          <SongBody item={item} format={format} />
        </section>
      ))}
    </article>
  );
}
