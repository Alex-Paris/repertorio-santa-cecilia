"use client";

import { Maximize, Minimize, Pause, Play, SlidersHorizontal, X, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import { cn } from "cn";

import { Button } from "@/components/ui/button";

import type { MusicalKey } from "../domain/musical-key";
import { transposeKey } from "../domain/transposition";
import { useAutoScroll } from "../hooks/use-auto-scroll";
import { useFullscreen } from "../hooks/use-fullscreen";
import { usePresentationLock } from "../hooks/use-presentation-lock";
import { usePresentationShortcuts } from "../hooks/use-presentation-shortcuts";
import { readerPreferencesStore } from "../data/reader-preferences-store";
import { PRESENTATION_THEMES, type PresentationTheme } from "../domain/reader-preferences";
import { useReaderPreferences } from "../hooks/use-reader-preferences";
import { ChordSheet } from "./chord-sheet";
import { ExternalSourceNotice } from "./external-source-notice";
import { KeyLabel } from "./key-label";
import { FontSizeControls, ReadingModeToggle, ScrollSpeedControls } from "./reader-controls";
import { DISABLED_LOOK, TransposeControls } from "./transpose-controls";

export interface PresentationContent {
  title: string | null;
  artist?: string;
  /** Ausente quando a música não tem tom a exibir, como em links externos. */
  originalKey?: MusicalKey;
  chordPro?: string;
  sourceUrl?: string;
  /** Mostrada quando não há cifra nem link. */
  emptyMessage?: string;
  notes?: string;
}

export interface PresentationNavigation {
  position: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

interface PresentationStageProps {
  content: PresentationContent;
  semitones: number;
  navigation: PresentationNavigation | null;
  returnLink: { href: string; name: string } | null;
  onSemitonesChange: (semitones: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onExit: () => void;
}

/** Barras de cima e de baixo e o painel de ajustes: margem própria, com a área segura do aparelho. */
const SAFE_SIDES =
  "pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))]";

/**
 * Área da cifra: mais respiro que as barras (1,25rem no celular, 2,5rem no computador), menos que
 * uma página comum, para sobrar largura à letra. O fim tem folga para os últimos versos subirem
 * do rodapé e serem lidos com calma durante a rolagem.
 */
const READING_SIDES =
  "pr-[max(1.25rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))] md:pr-[max(2.5rem,env(safe-area-inset-right))] md:pl-[max(2.5rem,env(safe-area-inset-left))]";

const END_OF_SHEET = "Fim da cifra. Use “Voltar ao início” para rolar de novo.";

const THEME_LABELS: Record<PresentationTheme, string> = { light: "Claro", dark: "Escuro" };

/** Fundo da apresentação, independente do tema do site: claro (pergaminho) por padrão. */
function PresentationThemeToggle({ theme }: { theme: PresentationTheme }) {
  return (
    <div role="group" aria-label="Fundo da apresentação" className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Fundo</span>
      <div className="inline-flex rounded-lg border p-0.5">
        {PRESENTATION_THEMES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={theme === option}
            onClick={() => readerPreferencesStore.update({ presentationTheme: option })}
            className="h-8 rounded-md px-3 font-medium aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {THEME_LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Só apresenta: de onde vêm os dados e o que fazer com o tom são decisões de quem o usa. */
export function PresentationStage({
  content,
  semitones,
  navigation,
  returnLink,
  onSemitonesChange,
  onPrevious,
  onNext,
  onExit,
}: PresentationStageProps) {
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const { fontSize, scrollSpeed, readingMode, presentationTheme } = useReaderPreferences();
  const lyricsOnly = readingMode === "lyrics";

  const scroll = useAutoScroll(scrollerRef, scrollSpeed, () => setStatus(END_OF_SHEET));
  const fullscreen = useFullscreen();
  usePresentationLock(containerRef);

  const { chordPro } = content;

  function resetForNewSong(): void {
    scroll.scrollToTop();
    setStatus("");
  }

  function goToPrevious(): void {
    if (navigation?.hasPrevious) {
      resetForNewSong();
      onPrevious();
    }
  }

  function goToNext(): void {
    if (navigation?.hasNext) {
      resetForNewSong();
      onNext();
    }
  }

  function handleToggleScroll(): void {
    setStatus(scroll.toggle() ? "" : END_OF_SHEET);
  }

  function handleScrollToTop(): void {
    scroll.scrollToTop();
    setStatus("");
  }

  usePresentationShortcuts({
    onToggleScroll: chordPro ? handleToggleScroll : undefined,
    onNext: navigation?.hasNext ? goToNext : undefined,
    onPrevious: navigation?.hasPrevious ? goToPrevious : undefined,
    onExit,
  });

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-presentation-theme={presentationTheme}
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background text-foreground outline-none",
        presentationTheme === "dark" ? "presentation-dark" : "presentation-light",
      )}
    >
      <header
        className={`flex items-center gap-2 border-b pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 ${SAFE_SIDES}`}
      >
        <Button variant="outline" size="lg" className="h-10 shrink-0 px-3" aria-label="Sair do modo apresentação" onClick={onExit}>
          <X data-icon="inline-start" aria-hidden />
          Sair
        </Button>

        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate leading-tight font-semibold">
            {content.title ?? "Música não encontrada"}
          </h2>
          <p className="truncate text-xs text-muted-foreground">{content.artist}</p>
        </div>

        {content.originalKey && !(lyricsOnly && chordPro) && (
          <p className="flex shrink-0 items-baseline gap-1 text-sm">
            <span aria-hidden className="text-muted-foreground">Tom</span>
            <KeyLabel musicalKey={transposeKey(content.originalKey, semitones)} />
          </p>
        )}

        {fullscreen.isSupported && (
          <Button
            variant="ghost"
            size="icon-lg"
            className="size-10 shrink-0"
            aria-label={fullscreen.isActive ? "Sair da tela cheia" : "Ativar tela cheia"}
            onClick={fullscreen.toggle}
          >
            {fullscreen.isActive ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
          </Button>
        )}
      </header>

      <div
        ref={scrollerRef}
        role="region"
        aria-label={lyricsOnly ? "Letra" : "Cifra"}
        tabIndex={0}
        className={`min-h-0 flex-1 overflow-auto overscroll-contain pt-6 pb-[max(4rem,20dvh)] outline-none md:pt-10 ${READING_SIDES}`}
      >
        <div className="mx-auto max-w-3xl">
          {content.notes && (
            <div className="mb-4 rounded-lg border bg-card px-3 py-2">
              <h3 className="text-xs font-medium text-muted-foreground">Anotações</h3>
              <p className="text-sm text-pretty wrap-break-word whitespace-pre-line">
                {content.notes}
              </p>
            </div>
          )}

          {content.sourceUrl && <ExternalSourceNotice sourceUrl={content.sourceUrl} />}
          {content.emptyMessage && !chordPro && (
            <p className="text-sm text-muted-foreground">{content.emptyMessage}</p>
          )}
          {chordPro && <ChordSheet source={chordPro} semitones={semitones} fontSize={fontSize} mode={readingMode} />}
        </div>
      </div>

      {settingsOpen && content.originalKey && chordPro && (
        <div className={`max-h-[45dvh] space-y-3 overflow-y-auto border-t py-3 ${SAFE_SIDES}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ReadingModeToggle compact />
            <PresentationThemeToggle theme={presentationTheme} />
          </div>
          {/* Na letra não há acordes: o tom fica guardado e volta igual ao retornar à cifra. */}
          {!lyricsOnly && (
            <TransposeControls
              originalKey={content.originalKey}
              semitones={semitones}
              onChange={onSemitonesChange}
            />
          )}
          <FontSizeControls fontSize={fontSize} />
          <ScrollSpeedControls speed={scrollSpeed} onScrollToTop={handleScrollToTop} />
          <p className="text-xs text-muted-foreground">
            Atalhos: Espaço inicia ou pausa · ← e → trocam de música · Esc sai
          </p>
        </div>
      )}

      <footer
        className={`flex items-center justify-between gap-2 border-t pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${SAFE_SIDES}`}
      >
        <div className="flex items-center gap-1">
          {navigation && (
            <>
              <Button
                variant="outline"
                size="icon-lg"
                className={`size-11 ${DISABLED_LOOK}`}
                aria-label="Música anterior"
                focusableWhenDisabled
                disabled={!navigation.hasPrevious}
                onClick={goToPrevious}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="icon-lg"
                className={`size-11 ${DISABLED_LOOK}`}
                aria-label="Próxima música"
                focusableWhenDisabled
                disabled={!navigation.hasNext}
                onClick={goToNext}
              >
                <ChevronRight aria-hidden />
              </Button>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1 text-xs text-muted-foreground">
          <p aria-live="polite" className="truncate">
            {status}
          </p>
          {!status && returnLink && navigation && (
            <>
              <Link
                href={returnLink.href}
                aria-label={`Voltar à lista de ${returnLink.name}`}
                className="truncate underline underline-offset-2"
              >
                {returnLink.name}
              </Link>
              <span className="shrink-0 tabular-nums">
                {navigation.position} de {navigation.total}
              </span>
            </>
          )}
        </div>

        {chordPro && (
          <div className="flex items-center gap-1">
            <Button
              size="icon-lg"
              className="size-11"
              aria-label={scroll.isRunning ? "Pausar rolagem" : "Iniciar rolagem"}
              onClick={handleToggleScroll}
            >
              {scroll.isRunning ? <Pause aria-hidden /> : <Play aria-hidden />}
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              className="size-11"
              aria-label={settingsOpen ? "Ocultar ajustes" : "Mostrar ajustes"}
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <SlidersHorizontal aria-hidden />
            </Button>
          </div>
        )}
      </footer>
    </div>
  );
}
