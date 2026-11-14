"use client";

import { cn } from "cn";
import { ArrowLeft, FileMusic, MonitorPlay, Music2 } from "lucide-react";
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
import { FontSizeControls } from "@/features/songs/components/reader-controls";
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
  /** No painel central, a cifra rola dentro da própria área. */
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
  const { fontSize } = useReaderPreferences();
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

        <header className="flex items-start gap-3">
          <Music2 className="mt-1 size-9 shrink-0 text-gold md:size-10" aria-hidden />
          <div className="min-w-0 flex-1">
            <Heading
              id="musica-titulo"
              className="font-display text-[1.7rem] leading-tight font-semibold text-balance text-heading md:text-[2.15rem]"
            >
              {song.title}
            </Heading>
            <p className="mt-0.5 text-[0.95rem] text-muted-foreground">{song.artist || "Autoria não informada"}</p>
            {song.compositionReference && <p className="mt-1 text-sm">{song.compositionReference}</p>}
          </div>
          {chordPro && (
            <Button size="lg" variant="outline" className="shrink-0" onClick={() => setPresenting(true)}>
              <MonitorPlay data-icon="inline-start" aria-hidden />
              Apresentar
            </Button>
          )}
        </header>

        {liturgy && (liturgy.moments.length > 0 || liturgy.seasons.length > 0 || themes.length > 0) && (
          <ul aria-label="Classificação litúrgica" className="mt-3 flex flex-wrap gap-2">
            {liturgy.moments.map((moment) => (
              <li key={moment}>
                <MomentTag moment={moment} className="px-3 py-1 text-sm" />
              </li>
            ))}
            {liturgy.seasons.map((season) => (
              <li key={season}>
                <SeasonTag season={season} className="px-3 py-1 text-sm" />
              </li>
            ))}
            {themes.length > 0 && (
              <li className="inline-flex items-center rounded-full border bg-background/60 px-3 py-1 text-sm text-muted-foreground">
                {themes.map(themeLabel).join(" · ")}
              </li>
            )}
          </ul>
        )}
        {liturgy?.suitabilityNotes && <p className="mt-3 text-[0.95rem] text-pretty">{liturgy.suitabilityNotes}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-3 border-t border-gold/20 pt-4">
          {song.contentType !== "external-link" && song.originalKey && (
            <p className="flex items-baseline gap-1.5 text-sm">
              <FileMusic className="size-4 self-center text-gold-strong" aria-hidden />
              <span aria-hidden>Tom original:</span>
              <KeyLabel musicalKey={song.originalKey} />
            </p>
          )}
          {chordPro && song.originalKey && (
            <TransposeControls
              originalKey={song.originalKey}
              semitones={semitones}
              onChange={setSemitones}
              hint="Ajuste temporário: a música do catálogo não é alterada."
              compact
            />
          )}
          <div className="ml-auto">
            <AddToRepertoire
              songId={song.id}
              title={song.title}
              originalKey={song.originalKey}
              contentType={song.contentType}
              suggestedMoments={liturgy?.moments}
              preferCurrent={currentRepertoire}
              primary
            />
          </div>
        </div>

        <section aria-labelledby="letra-e-cifra" className="mt-5">
          <div className="flex items-end justify-between gap-3 border-b border-gold/25">
            <h3
              id="letra-e-cifra"
              className="-mb-px inline-flex items-center gap-2 rounded-t-xl bg-primary px-5 py-2 font-display text-[1.02rem] font-medium whitespace-nowrap text-primary-foreground"
            >
              <FileMusic className="size-4" aria-hidden />
              Letra e cifra
            </h3>
            {chordPro && (
              <div className="pb-1.5">
                <FontSizeControls fontSize={fontSize} compact />
              </div>
            )}
          </div>

          <div className="mt-3">
            {song.contentType === "external-link" && <ExternalSourceNotice sourceUrl={song.sourceUrl} />}
            {song.contentType !== "external-link" && !chordPro && (
              <EmptyState icon={FileMusic} title="Cifra ainda não disponível" description={NO_CHORDS} />
            )}
            {chordPro && (
              <div
                // Com rolagem própria, a área recebe foco para quem usa teclado.
                {...(contained ? { tabIndex: 0, role: "region", "aria-label": `Letra e cifra de ${song.title}` } : {})}
                className={cn(
                  // Letra e acordes em serifa, como na referência; os acordes seguem em colunas sobre a sílaba.
                  "overflow-auto rounded-xl border bg-background/40 p-5 font-display md:p-7 [&_.font-mono]:font-display [&_.font-mono]:text-[0.95em]",
                  contained && "xl:max-h-[max(16rem,calc(100dvh-30rem))]",
                )}
              >
                <ChordSheet source={chordPro} semitones={semitones} fontSize={fontSize} />
              </div>
            )}
          </div>
        </section>

        <VideoReference title={song.title} className="mt-5" />

        {liturgy && (
          <div className="mt-5">
            <ClassificationSummary liturgy={liturgy} />
          </div>
        )}
        {song.metadataSources && song.metadataSources.length > 0 && <MetadataSources sources={song.metadataSources} />}
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
    <section aria-labelledby="fontes-dos-dados" className="mt-5 rounded-xl border bg-background/40 p-4 text-sm">
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
