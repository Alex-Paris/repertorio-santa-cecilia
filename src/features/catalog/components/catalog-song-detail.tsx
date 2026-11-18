"use client";

import { cn } from "cn";
import { ArrowLeft, ChevronDown, FileMusic, MonitorPlay, Music2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import type { CatalogSongView } from "@/features/library/domain/library";
import { ClassificationSummary } from "@/features/liturgy/components/classification-summary";
import { MomentTag, SeasonTag } from "@/features/liturgy/components/liturgy-tags";
import { themeLabel } from "@/features/liturgy/domain/vocabulary";
import { ChordSheet } from "@/features/songs/components/chord-sheet";
import { ExternalSourceNotice } from "@/features/songs/components/external-source-notice";
import { KeyLabel } from "@/features/songs/components/key-label";
import { PresentationStage } from "@/features/songs/components/presentation-stage";
import { PrintMenu } from "@/features/printing/components/print-menu";
import { FontSizeControls, ReadingModeToggle } from "@/features/songs/components/reader-controls";
import { TransposeControls } from "@/features/songs/components/transpose-controls";
import { VideoReference } from "@/features/songs/components/video-reference";
import { useReaderPreferences } from "@/features/songs/hooks/use-reader-preferences";

import { AddToRepertoire } from "./add-to-repertoire";

const NO_CHORDS =
  "O catálogo registra só a identificação e a classificação desta música. A letra e a cifra não são publicadas aqui sem autorização.";

interface CatalogSongDetailProps {
  song: CatalogSongView;
  /** 1 na página própria da música; 2 no painel central do catálogo, sob o título da página. */
  headingLevel?: 1 | 2;
  back?: { href: string; label: string };
  /** No catálogo em três zonas: o repertório atual já vem escolhido ao adicionar. */
  currentRepertoire?: { repertoireId: string | null };
  /** No painel central do catálogo, que rola por conta própria (a barra de controles se prende ao topo dele). */
  contained?: boolean;
  className?: string;
}

/**
 * Leitura pública de uma música do catálogo, como na referência: título, autoria, etiquetas
 * reais da classificação, tom e transposição, a cifra (só com permissão de exibição) e o espaço
 * da referência em vídeo. O tom ajustado aqui é só desta visita: a música do catálogo nunca muda.
 */
export function CatalogSongDetail({
  song,
  headingLevel = 1,
  back,
  currentRepertoire,
  contained = false,
  className,
}: CatalogSongDetailProps) {
  const { fontSize, readingMode } = useReaderPreferences();
  const [semitones, setSemitones] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const chordPro = song.contentType === "external-link" ? undefined : song.chordPro;
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const liturgy = song.liturgy;
  const themes = liturgy?.themes ?? [];

  return (
    <>
      <article
        data-app-chrome
        aria-labelledby="musica-titulo"
        className={cn("min-w-0 rounded-2xl border bg-card p-4 shadow-[0_1px_3px_rgb(71_45_27/0.06)] md:p-5", className)}
      >
        {back && (
          <Link
            href={back.href}
            className="mb-3 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}

        <header className="flex items-start gap-2.5">
          <Music2 className="mt-1 size-7 shrink-0 text-gold md:size-8" aria-hidden />
          <div className="min-w-0 flex-1">
            <Heading
              id="musica-titulo"
              className="font-display text-[1.5rem] leading-tight font-semibold text-balance text-heading md:text-[1.85rem]"
            >
              {song.title}
            </Heading>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {song.artist || "Autoria não informada"}
              {song.compositionReference && <span className="text-foreground"> · {song.compositionReference}</span>}
            </p>
            {/* Quem enviou não é quem compôs nem quem canta: crédito discreto, só com nome autorizado. */}
            {song.contributorCredit && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Enviado por: <span className="text-foreground">{song.contributorCredit}</span>
              </p>
            )}
          </div>
        </header>

        {/* Etiquetas da classificação e, na mesma linha, as ações sobre a música. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          {liturgy && (liturgy.moments.length > 0 || liturgy.seasons.length > 0 || themes.length > 0) && (
            <ul aria-label="Classificação litúrgica" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {liturgy.moments.map((moment) => (
                <li key={moment}>
                  <MomentTag moment={moment} />
                </li>
              ))}
              {liturgy.seasons.map((season) => (
                <li key={season}>
                  <SeasonTag season={season} />
                </li>
              ))}
              {themes.length > 0 && (
                <li className="inline-flex items-center rounded-full border bg-background/60 px-2.5 py-0.5 text-[0.8rem] text-muted-foreground">
                  {themes.map(themeLabel).join(" · ")}
                </li>
              )}
            </ul>
          )}
          {/* Ações sobre a música; os controles de leitura ficam na barra presa sobre a cifra. */}
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
            {chordPro && (
              <Button size="lg" variant="outline" className="h-9 px-3" onClick={() => setPresenting(true)}>
                <MonitorPlay data-icon="inline-start" aria-hidden />
                Apresentar
              </Button>
            )}
            {chordPro && (
              <PrintMenu
                size="sm"
                align="end"
                options={[
                  { label: "Com cifra", href: `/catalogo/${encodeURIComponent(song.id)}/imprimir?modo=cifra${semitones !== 0 ? `&tom=${semitones}` : ""}` },
                  { label: "Somente letra", href: `/catalogo/${encodeURIComponent(song.id)}/imprimir?modo=letra` },
                ]}
              />
            )}
            <AddToRepertoire
              songId={song.id}
              title={song.title}
              originalKey={song.originalKey}
              contentType={song.contentType}
              suggestedMoments={liturgy?.moments}
              preferCurrent={currentRepertoire}
              primary
              popover
            />
          </div>
        </div>
        {liturgy?.suitabilityNotes && <p className="mt-2 text-sm text-pretty">{liturgy.suitabilityNotes}</p>}

        {/*
          Barra de controles presa ao topo enquanto a cifra rola: no catálogo (zona central com
          rolagem própria) fica no topo da zona; na página própria, sob o cabeçalho.
        */}
        <div
          role="group"
          aria-label="Controles da cifra"
          className={cn(
            "sticky z-10 -mx-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-gold/25 bg-card/95 px-4 py-2 backdrop-blur md:-mx-5 md:px-5",
            contained ? "top-14 md:top-0" : "top-14 md:top-16 lg:top-[4.6rem]",
            // Em telas baixas o cabeçalho não fica preso: a barra encosta no topo.
            "[@media(max-height:520px)]:top-0",
          )}
        >
          {song.contentType !== "external-link" && song.originalKey && (
            <p className="flex items-baseline gap-1.5 text-sm">
              <span aria-hidden>Tom original:</span>
              <KeyLabel musicalKey={song.originalKey} />
            </p>
          )}
          {chordPro && <ReadingModeToggle compact />}
          {/* Na letra não há acordes a transpor; o tom escolhido volta igual na cifra. */}
          {chordPro && song.originalKey && readingMode === "chords" && (
            <TransposeControls
              originalKey={song.originalKey}
              semitones={semitones}
              onChange={setSemitones}
              hint="Ajuste temporário: a música do catálogo não é alterada."
              compact
            />
          )}
          {chordPro && <FontSizeControls fontSize={fontSize} compact />}
          {!chordPro && <p className="text-sm text-muted-foreground">Sem cifra para ajustar.</p>}
        </div>

        <section aria-labelledby="letra-e-cifra" className="mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="letra-e-cifra" className="inline-flex items-center gap-2 font-display text-[1.05rem] font-semibold text-heading">
              <FileMusic className="size-4 text-gold-strong" aria-hidden />
              Letra e cifra
            </h3>
            <VideoReference videoId={song.video?.videoId} videoTitle={song.video?.title} title={song.title} />
          </div>

          <div className="mt-2">
            {song.contentType === "external-link" && <ExternalSourceNotice sourceUrl={song.sourceUrl} />}
            {song.contentType !== "external-link" && !chordPro && (
              <EmptyState icon={FileMusic} title="Cifra ainda não disponível" description={NO_CHORDS} />
            )}
            {chordPro && (
              // Letra e acordes em serifa, como na referência; os acordes seguem em colunas sobre a sílaba.
              // Sem rolagem própria: a cifra usa toda a altura da zona (ou da página).
              <div className="overflow-x-auto rounded-xl border bg-background/40 px-5 py-4 font-display md:px-7 md:py-5 [&_.font-mono]:font-display [&_.font-mono]:text-[0.95em]">
                <ChordSheet source={chordPro} semitones={semitones} fontSize={fontSize} mode={readingMode} />
              </div>
            )}
          </div>
        </section>

        {(liturgy || (song.metadataSources && song.metadataSources.length > 0)) && (
          <details className="group mt-4 rounded-xl border bg-background/40">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-heading [&::-webkit-details-marker]:hidden">
              Classificação litúrgica e fontes
              {liturgy && (
                <span className="text-xs font-normal text-muted-foreground">
                  · {liturgy.reviewStatus === "reviewed" ? "conferida pela equipe" : liturgy.reviewStatus === "disputed" ? "com divergência" : "ainda não conferida"}
                </span>
              )}
              <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="space-y-4 border-t px-4 pt-3 pb-4">
              {liturgy && <ClassificationSummary liturgy={liturgy} />}
              {song.metadataSources && song.metadataSources.length > 0 && <MetadataSources sources={song.metadataSources} />}
            </div>
          </details>
        )}
      </article>

      {presenting && chordPro && song.originalKey && (
        <PresentationStage
          content={{ title: song.title, artist: song.artist, originalKey: song.originalKey, chordPro }}
          semitones={semitones}
          navigation={null}
          returnLink={null}
          onSemitonesChange={setSemitones}
          onPrevious={() => undefined}
          onNext={() => undefined}
          onExit={() => setPresenting(false)}
        />
      )}
    </>
  );
}

function MetadataSources({ sources }: { sources: NonNullable<CatalogSongView["metadataSources"]> }) {
  return (
    <section aria-labelledby="fontes-dos-dados" className="rounded-xl border bg-card p-4 text-sm">
      <h3 id="fontes-dos-dados" className="font-display text-base font-semibold text-heading">
        Fontes da identificação
      </h3>
      <ul className="mt-2 space-y-1.5">
        {sources.map((source) => (
          <li key={`${source.title}-${source.url ?? ""}`} className="wrap-break-word">
            {source.url ? (
              <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
                {source.title}
              </a>
            ) : (
              source.title
            )}
            {source.accessedAt && (
              <span className="text-muted-foreground">
                {" "}
                · consultada em {new Date(source.accessedAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Fontes usadas para conferir título e autoria. Não concedem direito de reprodução.
      </p>
    </section>
  );
}
