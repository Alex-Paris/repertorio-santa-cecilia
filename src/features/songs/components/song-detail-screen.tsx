"use client";

import { FileMusic, MonitorPlay, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { MENU_ITEM_CLASS, MoreActionsMenu } from "@/components/layout/more-actions-menu";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Button } from "@/components/ui/button";
import { songRepository } from "@/features/library/data/browser-library";
import { LibraryGate } from "@/features/library/components/library-gate";
import type { Library } from "@/features/library/domain/library";
import { RepertoireReadingPanel } from "@/features/repertoires/components/repertoire-reading-panel";
import type { Repertoire } from "@/features/repertoires/domain/repertoire";
import { findRepertoiresUsingSong } from "@/features/repertoires/services/repertoire-items";
import { saveItemSemitones, useItemSemitones } from "@/features/repertoires/components/save-item-semitones";
import {
  getRepertoireSongHref,
  getSongEditHref,
  resolveRepertoireReadingContext,
  type RepertoireContextReference,
  type RepertoireReadingContext,
} from "@/features/repertoires/services/repertoire-reading-context";
import { showToast } from "@/lib/utils/toast";
import { useDocumentTitle } from "@/lib/utils/use-document-title";

import { findLibrarySong } from "@/features/library/domain/library";
import {
  isActiveSubmission,
  SongSubmissionAction,
  useSongSubmission,
} from "@/features/contributions/components/song-submission-action";

import { PrintMenu } from "@/features/printing/components/print-menu";

import type { ReadingMode } from "../domain/reader-preferences";
import type { MusicalSong, Song, SongId, SongSource } from "../domain/song";
import { ChordReader } from "./chord-reader";
import { ContentTypeBadge } from "./content-type-badge";
import { DeleteSongButton } from "./delete-song-button";
import { useReaderPreferences } from "../hooks/use-reader-preferences";
import { ExternalSourceNotice } from "./external-source-notice";
import { PresentationReader, type PresentationTarget } from "./presentation-reader";
import { SongReadingHeader } from "./song-reading-header";
import { SongNotFound } from "./song-not-found";
import { VideoReference } from "./video-reference";

interface SongContentProps {
  song: MusicalSong;
  source: SongSource;
  semitones: number;
  fontSize: number;
  readingMode: ReadingMode;
  isPersisted: boolean;
  onSemitonesChange: (semitones: number) => void;
}

function SongContent({
  song,
  source,
  semitones,
  fontSize,
  readingMode,
  isPersisted,
  onSemitonesChange,
}: SongContentProps) {
  if (song.contentType === "external-link") {
    return <ExternalSourceNotice sourceUrl={song.sourceUrl} />;
  }

  if (!song.chordPro) {
    return source === "catalog" ? (
      <EmptyState
        icon={FileMusic}
        title="Cifra indisponível"
        description="A cifra desta música não está disponível no catálogo. Título, artista e tom continuam no repertório."
      />
    ) : (
      <EmptyState
        icon={FileMusic}
        title="Cifra ainda não adicionada"
        description="Esta música está na biblioteca, mas ainda não tem uma cifra."
      />
    );
  }

  return (
    <ChordReader chordPro={song.chordPro} originalKey={song.originalKey} semitones={semitones} fontSize={fontSize} readingMode={readingMode}
      adjustmentHint={isPersisted ? "Ajuste salvo somente neste repertório." : "Ajuste temporário: a música não é alterada."} onSemitonesChange={onSemitonesChange} />
  );
}

interface SongDetailProps {
  song: MusicalSong;
  source: SongSource;
  /** Só músicas particulares podem ser editadas ou excluídas aqui. */
  personalSong: Song | null;
  library: Library;
  usedBy: readonly Repertoire[];
  context: RepertoireReadingContext | null;
  hasInvalidContext: boolean;
  onDelete: () => Promise<void>;
}

function getTargetHref({ songId, source = "personal", reference }: PresentationTarget): string {
  if (reference) {
    return getRepertoireSongHref(reference.repertoireId, { id: reference.itemId, songId, source });
  }
  return `${source === "catalog" ? "/catalogo" : "/musicas"}/${encodeURIComponent(songId)}`;
}

function SongDetail({
  song,
  source,
  personalSong,
  library,
  usedBy,
  context,
  hasInvalidContext,
  onDelete,
}: SongDetailProps) {
  useDocumentTitle(song.title);

  const router = useRouter();
  const { fontSize, readingMode } = useReaderPreferences();
  const [temporarySemitones, setTemporarySemitones] = useState(0);
  const [presentationTarget, setPresentationTarget] = useState<PresentationTarget | null>(null);
  const itemSemitones = useItemSemitones(
    context && { repertoireId: context.repertoire.id, itemId: context.item.id },
    context?.item.transposeSemitones ?? 0,
  );
  const semitones = context ? itemSemitones : temporarySemitones;
  const canPresent = context !== null || (song.contentType !== "external-link" && Boolean(song.chordPro));
  const video = source === "catalog" ? library.catalogSongs.find((candidate) => candidate.id === song.id)?.video : undefined;
  const { userId: accountId, submission } = useSongSubmission(personalSong ? song.id : null);

  function handleSemitonesChange(next: number): void {
    if (context) {
      void saveItemSemitones(context, next);
    } else {
      setTemporarySemitones(next);
    }
  }

  function startPresentation(): void {
    setPresentationTarget({
      songId: song.id,
      source,
      reference: context ? { repertoireId: context.repertoire.id, itemId: context.item.id } : null,
    });
  }

  // Dentro do modo apresentação a troca é local: sem esqueleto de carregamento no palco.
  function handlePresentationNavigate(target: PresentationTarget): void {
    setPresentationTarget(target);
    window.history.replaceState(null, "", getTargetHref(target));
  }

  function exitPresentation(): void {
    const target = presentationTarget;
    const movedToOtherSong =
      target !== null &&
      (target.songId !== song.id ||
        (target.source ?? "personal") !== source ||
        target.reference?.itemId !== context?.item.id);

    startTransition(() => {
      if (target && movedToOtherSong) {
        router.replace(getTargetHref(target));
      }
      setPresentationTarget(null);
    });
  }

  return (
    <>
      <div data-app-chrome>
        <SongReadingHeader
          title={song.title}
          artist={song.artist}
          originalKey={song.originalKey}
          back={
            context
              ? { href: `/repertorios/${context.repertoire.id}`, label: context.repertoire.name }
              : source === "catalog"
                ? { href: "/catalogo", label: "Catálogo" }
                : { href: "/biblioteca", label: "Músicas" }
          }
          badge={source === "catalog" || song.contentType === "metadata-only" ? (
                  <span className="rounded-full border px-2 py-0.5 text-xs">Catálogo</span>
                ) : (
                  <ContentTypeBadge contentType={song.contentType} />
                )}
          actions={
            <>
              {video && <VideoReference key={`${song.id}:${video.videoId}:${video.startSeconds ?? 0}`} title={song.title} videoId={video.videoId} videoTitle={video.title} startSeconds={video.startSeconds} />}
              {canPresent && (
                <Button size="lg" onClick={startPresentation}>
                  <MonitorPlay data-icon="inline-start" aria-hidden />
                  Apresentar
                </Button>
              )}
              {/* Imprime no tom em que a música está sendo lida (o do item, num repertório). */}
              {song.contentType !== "external-link" && Boolean(song.chordPro) && (
                <PrintMenu
                  options={(["chords", "lyrics"] as const).map((mode) => ({
                    label: mode === "chords" ? "Com cifra" : "Somente letra",
                    href: `${source === "catalog" ? "/catalogo" : "/musicas"}/${encodeURIComponent(song.id)}/imprimir?modo=${mode === "chords" ? "cifra" : "letra"}${semitones !== 0 ? `&tom=${semitones}` : ""}`,
                  }))}
                />
              )}
              {/* Ações de manutenção num menu "Mais": à vista ficam apresentar e imprimir. */}
              {personalSong && (
                <MoreActionsMenu label="Mais ações da música">
              <Link href={getSongEditHref(song.id, context)} className={MENU_ITEM_CLASS}>
                <Pencil aria-hidden />
                Editar
              </Link>
              {accountId && <SongSubmissionAction songId={song.id} submission={submission} asMenuItem />}
              <DeleteSongButton
                song={personalSong}
                usedBy={usedBy}
                onConfirm={onDelete}
                asMenuItem
                contributionNotice={
                  isActiveSubmission(submission)
                    ? "Esta música tem uma sugestão em andamento para o catálogo. A sugestão guarda a própria cópia e continua em análise; se preferir, retire-a em Minhas sugestões."
                    : submission?.status === "approved"
                      ? "A versão aprovada no catálogo não é afetada."
                      : undefined
                }
              />
                </MoreActionsMenu>
              )}
            </>
          }
        />
        {context && <RepertoireReadingPanel song={song} context={context} />}
        {hasInvalidContext && (
          <p className="mb-4 text-sm text-muted-foreground">
            O repertório deste link não foi encontrado para esta música. Exibindo o tom original.
          </p>
        )}
        <SongContent
          song={song}
          source={source}
          semitones={semitones}
          fontSize={fontSize}
          readingMode={readingMode}
          isPersisted={context !== null}
          onSemitonesChange={handleSemitonesChange}
        />
      </div>

      {presentationTarget && (
        <PresentationReader
          library={library}
          target={presentationTarget}
          temporarySemitones={temporarySemitones}
          onTemporarySemitonesChange={setTemporarySemitones}
          onNavigate={handlePresentationNavigate}
          onExit={exitPresentation}
        />
      )}
    </>
  );
}

interface SongDetailScreenProps {
  songId: SongId;
  /** Particular por padrão; o catálogo aparece aqui somente no contexto de um repertório. */
  source?: SongSource;
  /** IDs vindos da URL; só valem depois de conferidos com os dados salvos. */
  contextReference?: RepertoireContextReference;
}

export function SongDetailScreen({ songId, source = "personal", contextReference }: SongDetailScreenProps) {
  const router = useRouter();
  // Evita mostrar "não encontrada" entre a exclusão e a chegada à biblioteca.
  const [leaving, setLeaving] = useState(false);

  /** Com a revisão em tela: uma versão alterada em outro lugar exige nova confirmação. */
  async function handleDelete(revision: number): Promise<void> {
    setLeaving(true);
    try {
      await songRepository.delete(songId, revision);
    } catch (error) {
      setLeaving(false);
      throw error;
    }
    showToast("Música excluída.");
    router.replace("/biblioteca");
  }

  return (
    <LibraryGate>
      {(library) => {
        const { songs, repertoires } = library;
        const song = findLibrarySong(library, source, songId);
        const personalSong =
          source === "personal" ? (songs.find((candidate) => candidate.id === songId) ?? null) : null;

        if (!song) {
          return leaving ? <PageSkeleton /> : <SongNotFound />;
        }

        const context = contextReference
          ? resolveRepertoireReadingContext(repertoires, song.id, contextReference, source)
          : null;

        return (
          <SongDetail
            // Novas navegações reiniciam o ajuste temporário; voltar e avançar o preservam.
            key={router.bfcacheId}
            song={song}
            source={source}
            personalSong={personalSong}
            library={library}
            usedBy={findRepertoiresUsingSong(repertoires, song.id)}
            context={context}
            hasInvalidContext={contextReference !== undefined && context === null}
            onDelete={() => (personalSong ? handleDelete(personalSong.revision) : Promise.resolve())}
          />
        );
      }}
    </LibraryGate>
  );
}
