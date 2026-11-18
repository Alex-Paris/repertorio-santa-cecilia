"use client";

import { useState } from "react";

import type { CatalogSongView } from "@/features/library/domain/library";
import { LibraryGate } from "@/features/library/components/library-gate";
import { formatLongDate } from "@/features/liturgy/domain/calendar";
import { RepertoireNotFound } from "@/features/repertoires/components/repertoire-not-found";
import { buildRepertoireEntries } from "@/features/repertoires/services/repertoire-service";
import type { PublicShareSnapshot } from "@/features/sharing/domain/public-share";
import { SongNotFound } from "@/features/songs/components/song-not-found";
import type { MusicalSong } from "@/features/songs/domain/song";

import {
  buildRepertoirePrint,
  buildSharePrint,
  buildSongPrint,
  printFormatParam,
  REPERTOIRE_PRINT_LABELS,
  SONG_PRINT_LABELS,
  type PrintFormat,
} from "../domain/print-model";
import { PrintView, replaceSearchParam } from "./print-view";

function useFormat(initial: PrintFormat, param: string, plural: boolean) {
  const [format, setFormat] = useState(initial);
  return [
    format,
    (next: PrintFormat) => {
      setFormat(next);
      replaceSearchParam(param, printFormatParam(next, plural));
    },
  ] as const;
}

/**
 * Repertório da conta, lido da biblioteca da sessão (a mesma do detalhe do repertório): ordem,
 * momentos e tom de cada item, sem anotações. Nada é salvo nem publicado para imprimir.
 */
export function RepertoirePrintScreen({ repertoireId, initialFormat }: { repertoireId: string; initialFormat: PrintFormat }) {
  const [format, setFormat] = useFormat(initialFormat, "formato", true);

  return (
    <LibraryGate>
      {({ songs, repertoires, catalogSongs }) => {
        const repertoire = repertoires.find((candidate) => candidate.id === repertoireId);
        if (!repertoire) return <RepertoireNotFound />;
        const items = buildRepertoirePrint(buildRepertoireEntries(repertoire.items, songs, catalogSongs), format);
        const lines = repertoire.mass ? [repertoire.mass.title, formatLongDate(repertoire.mass.date)] : [];
        return (
          <PrintView
            heading="Imprimir repertório"
            name={repertoire.name}
            back={{ href: `/repertorios/${repertoire.id}`, label: repertoire.name }}
            format={format}
            formatLabels={REPERTOIRE_PRINT_LABELS}
            onFormatChange={setFormat}
            items={items}
            header={{ title: repertoire.name, lines }}
            details={lines.length > 0 ? <p className="text-sm text-muted-foreground first-letter:uppercase">{lines.join(" · ")}</p> : null}
          />
        );
      }}
    </LibraryGate>
  );
}

interface SongPrintProps {
  initialFormat: PrintFormat;
  semitones: number;
  back: { href: string; label: string };
}

function SongPrint({ song, initialFormat, semitones, back }: SongPrintProps & { song: MusicalSong & { chordPro?: string } }) {
  const [format, setFormat] = useFormat(initialFormat, "modo", false);
  return (
    <PrintView
      heading="Imprimir música"
      name={song.title}
      back={back}
      format={format}
      formatLabels={SONG_PRINT_LABELS}
      onFormatChange={setFormat}
      items={[buildSongPrint(song, semitones, format)]}
      single
    />
  );
}

/** Música particular: só da biblioteca da própria conta. */
export function PersonalSongPrintScreen({ songId, ...props }: Omit<SongPrintProps, "back"> & { songId: string }) {
  return (
    <LibraryGate>
      {({ songs }) => {
        const song = songs.find((candidate) => candidate.id === songId);
        if (!song) return <SongNotFound />;
        return <SongPrint song={song} back={{ href: `/musicas/${song.id}`, label: song.title }} {...props} />;
      }}
    </LibraryGate>
  );
}

/** Música do catálogo: a mesma projeção pública do leitor (cifra só com permissão de exibição). */
export function CatalogSongPrintScreen({ song, ...props }: Omit<SongPrintProps, "back"> & { song: CatalogSongView }) {
  return <SongPrint song={song} back={{ href: `/catalogo/${song.id}`, label: song.title }} {...props} />;
}

/** Link público: só o retrato publicado; um link revogado nem chega aqui. */
export function SharePrintScreen({ token, share, initialFormat }: { token: string; share: PublicShareSnapshot; initialFormat: PrintFormat }) {
  const [format, setFormat] = useFormat(initialFormat, "formato", true);
  const lines = share.mass ? [share.mass.title, share.mass.date ? formatLongDate(share.mass.date) : ""].filter(Boolean) : [];
  return (
    <PrintView
      heading="Imprimir repertório"
      name={share.name}
      back={{ href: `/s/${token}`, label: share.name }}
      format={format}
      formatLabels={REPERTOIRE_PRINT_LABELS}
      onFormatChange={setFormat}
      items={buildSharePrint(share, format)}
      header={{ title: share.name, lines }}
    />
  );
}
