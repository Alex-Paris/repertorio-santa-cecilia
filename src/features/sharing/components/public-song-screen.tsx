"use client";

import { FileMusic, MonitorPlay } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { RepertoireReadingFrame } from "@/features/repertoires/components/repertoire-reading-panel";
import { PrintMenu } from "@/features/printing/components/print-menu";
import { ChordReader } from "@/features/songs/components/chord-reader";
import { ExternalSourceNotice } from "@/features/songs/components/external-source-notice";
import { PresentationStage } from "@/features/songs/components/presentation-stage";
import { SongReadingHeader } from "@/features/songs/components/song-reading-header";
import { VideoReference } from "@/features/songs/components/video-reference";
import { transposeKey } from "@/features/songs/domain/transposition";
import { useReaderPreferences } from "@/features/songs/hooks/use-reader-preferences";
import { useDocumentTitle } from "@/lib/utils/use-document-title";

import type { PublicShareItem, PublicShareSnapshot } from "../domain/public-share";
import { ShareUnavailable } from "./share-unavailable";
import { SharedRepertoireMenu } from "./clone-shared-repertoire";

const NO_CHORDS_MESSAGE = "A cifra desta música não foi incluída nesta publicação.";
const UNAVAILABLE_MESSAGE = "Esta música não está mais disponível neste link.";

interface PublicSongReaderProps {
  token: string;
  share: PublicShareSnapshot;
  item: PublicShareItem;
}

function PublicSongReader({ token, share, item }: PublicSongReaderProps) {
  useDocumentTitle(item.title);

  const router = useRouter();
  const { fontSize, readingMode } = useReaderPreferences();
  // Só nesta tela e nesta visita: nada aqui chega à biblioteca de quem publicou.
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [presentingId, setPresentingId] = useState<string | null>(null);

  const listHref = `/s/${token}`;
  const hrefOf = (candidate: PublicShareItem): string => `${listHref}/musicas/${candidate.id}`;
  const semitonesOf = (candidate: PublicShareItem): number =>
    adjustments[candidate.id] ?? candidate.transposeSemitones;
  const adjust = (candidate: PublicShareItem, semitones: number): void =>
    setAdjustments((current) => ({ ...current, [candidate.id]: semitones }));

  const index = share.items.findIndex((candidate) => candidate.id === item.id);
  const previous = share.items[index - 1] ?? null;
  const next = share.items[index + 1] ?? null;

  const presenting = share.items.find((candidate) => candidate.id === presentingId) ?? null;
  const presentingIndex = presenting ? share.items.indexOf(presenting) : -1;

  // Dentro do modo apresentação a troca é local: sem esqueleto de carregamento no palco.
  function presentItem(target: PublicShareItem | undefined): void {
    if (target) {
      setPresentingId(target.id);
      window.history.replaceState(null, "", hrefOf(target));
    }
  }

  function exitPresentation(): void {
    const moved = presenting !== null && presenting.id !== item.id;
    startTransition(() => {
      if (moved) {
        router.replace(hrefOf(presenting));
      }
      setPresentingId(null);
    });
  }

  return (
    <>
      <div data-app-chrome>
        <SongReadingHeader
          title={item.title}
          artist={item.artist}
          originalKey={item.originalKey}
          back={{ href: listHref, label: share.name }}
          badge={<span className="rounded-full border px-2 py-0.5 text-xs">Compartilhado</span>}
          actions={
            <>
            {item.video && <VideoReference videoId={item.video.videoId} videoTitle={item.video.title} startSeconds={item.video.startSeconds} title={item.title} />}
            <Button size="lg" onClick={() => setPresentingId(item.id)}>
              <MonitorPlay data-icon="inline-start" aria-hidden />
              Apresentar
            </Button>
            {item.content.kind === "chordpro" && <PrintMenu options={[
              { label: "Com cifra", href: `${listHref}/imprimir?formato=cifras&item=${item.id}&tom=${semitonesOf(item)}` },
              { label: "Somente letra", href: `${listHref}/imprimir?formato=letras&item=${item.id}` },
            ]} />}
            <SharedRepertoireMenu token={token} returnHref={hrefOf(item)} />
            </>
          }
        />

        <RepertoireReadingFrame name={share.name} href={listHref}
          moment={item.moment}
          configuredKey={item.content.kind === "chordpro" && item.originalKey ? transposeKey(item.originalKey, item.transposeSemitones) : undefined}
          navigation={{ position: index + 1, total: share.items.length, previousHref: previous && hrefOf(previous), nextHref: next && hrefOf(next) }} />

        {item.content.kind === "external-link" && (
          <ExternalSourceNotice sourceUrl={item.content.sourceUrl} />
        )}

        {item.content.kind === "none" && (
          <EmptyState icon={FileMusic} title="Cifra não incluída" description={NO_CHORDS_MESSAGE} />
        )}

        {item.content.kind === "unavailable" && (
          <EmptyState icon={FileMusic} title="Cifra indisponível" description={UNAVAILABLE_MESSAGE} />
        )}

        {item.content.kind === "chordpro" && item.originalKey && (
          <ChordReader chordPro={item.content.chordPro} originalKey={item.originalKey} semitones={semitonesOf(item)} fontSize={fontSize} readingMode={readingMode}
            adjustmentHint="Ajuste temporário: a publicação não é alterada." onSemitonesChange={(semitones) => adjust(item, semitones)} />
        )}
      </div>

      {presenting && (
        <PresentationStage
          content={{
            title: presenting.title,
            artist: presenting.artist,
            ...(presenting.content.kind === "external-link"
              ? { sourceUrl: presenting.content.sourceUrl }
              : {
                  originalKey: presenting.originalKey,
                  chordPro: presenting.content.kind === "chordpro" ? presenting.content.chordPro : undefined,
                  emptyMessage:
                    presenting.content.kind === "unavailable" ? UNAVAILABLE_MESSAGE : NO_CHORDS_MESSAGE,
                }),
          }}
          semitones={semitonesOf(presenting)}
          navigation={{
            position: presentingIndex + 1,
            total: share.items.length,
            hasPrevious: presentingIndex > 0,
            hasNext: presentingIndex < share.items.length - 1,
          }}
          returnLink={{ href: listHref, name: share.name }}
          onSemitonesChange={(semitones) => adjust(presenting, semitones)}
          onPrevious={() => presentItem(share.items[presentingIndex - 1])}
          onNext={() => presentItem(share.items[presentingIndex + 1])}
          onExit={exitPresentation}
        />
      )}
    </>
  );
}

interface PublicSongScreenProps {
  token: string;
  share: PublicShareSnapshot;
  itemId: string;
}

export function PublicSongScreen({ token, share, itemId }: PublicSongScreenProps) {
  const { bfcacheId } = useRouter();
  const item = share.items.find((candidate) => candidate.id === itemId);

  return item ? (
    <PublicSongReader key={`${bfcacheId}-${item.id}`} token={token} share={share} item={item} />
  ) : (
    <ShareUnavailable />
  );
}
