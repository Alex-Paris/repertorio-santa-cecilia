"use client";

import { cn } from "cn";
import { ChevronLeft, ChevronRight, FileMusic, MonitorPlay } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { momentLabel } from "@/features/liturgy/domain/vocabulary";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChordSheet } from "@/features/songs/components/chord-sheet";
import { ExternalSourceNotice } from "@/features/songs/components/external-source-notice";
import { KeyLabel } from "@/features/songs/components/key-label";
import { PresentationStage } from "@/features/songs/components/presentation-stage";
import { FontSizeControls, ReadingModeToggle } from "@/features/songs/components/reader-controls";
import { TransposeControls } from "@/features/songs/components/transpose-controls";
import { transposeKey } from "@/features/songs/domain/transposition";
import { useReaderPreferences } from "@/features/songs/hooks/use-reader-preferences";
import { useDocumentTitle } from "@/lib/utils/use-document-title";

import type { PublicShareItem, PublicShareSnapshot } from "../domain/public-share";
import { ShareUnavailable } from "./share-unavailable";

const NO_CHORDS_MESSAGE = "A cifra desta música não foi incluída nesta publicação.";
const UNAVAILABLE_MESSAGE = "Esta música não está mais disponível neste link.";

function NeighborLink({ href, direction }: { href: string | null; direction: "previous" | "next" }) {
  const isPrevious = direction === "previous";
  const label = isPrevious ? "Anterior" : "Próxima";
  const Icon = isPrevious ? ChevronLeft : ChevronRight;
  const content = (
    <>
      {isPrevious && <Icon data-icon="inline-start" aria-hidden />}
      {label}
      {!isPrevious && <Icon data-icon="inline-end" aria-hidden />}
    </>
  );

  if (!href) {
    return (
      <Button variant="outline" size="lg" disabled>
        {content}
      </Button>
    );
  }
  return (
    <Link href={href} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
      {content}
    </Link>
  );
}

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

  const isExternal = item.content.kind === "external-link";

  return (
    <>
      <div data-app-chrome>
        <PageHeader
          title={item.title}
          back={{ href: listHref, label: share.name }}
          description={
            <>
              <p>{item.artist}</p>
              {item.moment && <p className="mt-1 text-sm">Momento da missa: {momentLabel(item.moment)}</p>}
              {!isExternal && item.originalKey && (
                <p className="mt-3 flex items-baseline gap-1.5 text-sm">
                  <span aria-hidden>Tom publicado</span>
                  <KeyLabel musicalKey={transposeKey(item.originalKey, item.transposeSemitones)} />
                </p>
              )}
            </>
          }
          actions={
            <Button size="lg" onClick={() => setPresentingId(item.id)}>
              <MonitorPlay data-icon="inline-start" aria-hidden />
              Apresentar
            </Button>
          }
        />

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
          <>
            <div className="mb-4">
              <ReadingModeToggle />
            </div>
            {readingMode === "chords" && (
              <TransposeControls
                className="mb-4"
                originalKey={item.originalKey}
                semitones={semitonesOf(item)}
                onChange={(semitones) => adjust(item, semitones)}
                hint="Ajuste temporário: a publicação não é alterada."
              />
            )}
            <div className="mb-4">
              <FontSizeControls fontSize={fontSize} />
            </div>
            <article className="overflow-x-auto rounded-xl border bg-card p-5 md:p-8">
              <ChordSheet source={item.content.chordPro} semitones={semitonesOf(item)} fontSize={fontSize} mode={readingMode} />
            </article>
          </>
        )}

        <nav aria-label="Músicas publicadas" className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <NeighborLink href={previous && hrefOf(previous)} direction="previous" />
          <span className="text-sm text-muted-foreground tabular-nums">
            Música {index + 1} de {share.items.length}
          </span>
          <NeighborLink href={next && hrefOf(next)} direction="next" />
        </nav>
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
