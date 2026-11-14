"use client";

import { findLibrarySong, type Library } from "@/features/library/domain/library";
import { saveItemSemitones, useItemSemitones } from "@/features/repertoires/components/save-item-semitones";
import type { RepertoireItem } from "@/features/repertoires/domain/repertoire";
import { getRepertoireNavigation } from "@/features/repertoires/services/repertoire-navigation";
import {
  resolveRepertoireReadingContext,
  type RepertoireContextReference,
} from "@/features/repertoires/services/repertoire-reading-context";

import type { SongId, SongSource } from "../domain/song";
import { PresentationStage, type PresentationContent } from "./presentation-stage";

export interface PresentationTarget {
  songId: SongId;
  /** Sem origem, a música é particular. */
  source?: SongSource;
  reference: RepertoireContextReference | null;
}

interface PresentationReaderProps {
  library: Library;
  target: PresentationTarget;
  temporarySemitones: number;
  onTemporarySemitonesChange: (semitones: number) => void;
  onNavigate: (target: PresentationTarget) => void;
  onExit: () => void;
}

/** Apresentação da biblioteca do usuário: o tom de um item é salvo no repertório. */
export function PresentationReader({
  library,
  target,
  temporarySemitones,
  onTemporarySemitonesChange,
  onNavigate,
  onExit,
}: PresentationReaderProps) {
  const source = target.source ?? "personal";
  const song = findLibrarySong(library, source, target.songId);
  const context =
    song && target.reference
      ? resolveRepertoireReadingContext(library.repertoires, song.id, target.reference, source)
      : null;
  const navigation = context ? getRepertoireNavigation(context.repertoire, context.item.id) : null;
  const itemSemitones = useItemSemitones(
    context && { repertoireId: context.repertoire.id, itemId: context.item.id },
    context?.item.transposeSemitones ?? 0,
  );
  const semitones = context ? itemSemitones : temporarySemitones;

  const content: PresentationContent = {
    title: song?.title ?? null,
    artist: song?.artist,
    notes: context?.item.notes,
    ...(song?.contentType === "external-link"
      ? { sourceUrl: song.sourceUrl }
      : song
        ? {
            originalKey: song.originalKey,
            chordPro: song.chordPro,
            emptyMessage:
              source === "catalog"
                ? "A cifra desta música não está disponível no catálogo."
                : "Esta música ainda não tem uma cifra.",
          }
        : {}),
  };

  function goTo(item: RepertoireItem | null | undefined): void {
    if (item && context) {
      onNavigate({
        songId: item.songId,
        source: item.source,
        reference: { repertoireId: context.repertoire.id, itemId: item.id },
      });
    }
  }

  function handleSemitonesChange(next: number): void {
    if (context) {
      void saveItemSemitones(context, next);
    } else {
      onTemporarySemitonesChange(next);
    }
  }

  return (
    <PresentationStage
      content={content}
      semitones={semitones}
      navigation={
        navigation && {
          position: navigation.position,
          total: navigation.total,
          hasPrevious: navigation.previous !== null,
          hasNext: navigation.next !== null,
        }
      }
      returnLink={
        context && { href: `/repertorios/${context.repertoire.id}`, name: context.repertoire.name }
      }
      onSemitonesChange={handleSemitonesChange}
      onPrevious={() => goTo(navigation?.previous)}
      onNext={() => goTo(navigation?.next)}
      onExit={onExit}
    />
  );
}
