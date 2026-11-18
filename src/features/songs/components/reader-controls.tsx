"use client";

import { cn } from "cn";
import { ChevronsUp, Gauge, Minus, Plus, RotateCcw, Type } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useSyncExternalStore } from "react";

import { readerPreferencesStore } from "../data/reader-preferences-store";
import {
  clampFontSize,
  clampScrollSpeed,
  DEFAULT_FONT_SIZE,
  FONT_SIZE_STEP,
  MAX_FONT_SIZE,
  MAX_SCROLL_SPEED,
  MIN_FONT_SIZE,
  MIN_SCROLL_SPEED,
  READING_MODE_LABELS,
  READING_MODES,
  SCROLL_SPEED_STEP,
} from "../domain/reader-preferences";
import { DISABLED_LOOK } from "./transpose-controls";

interface StepButtonProps {
  label: string;
  disabled: boolean;
  onClick: () => void;
  icon: typeof Minus;
}

function StepButton({ label, disabled, onClick, icon: Icon }: StepButtonProps) {
  return (
    <Button
      variant="outline"
      size="icon-lg"
      className={cn("size-10", DISABLED_LOOK)}
      aria-label={label}
      focusableWhenDisabled
      disabled={disabled}
      onClick={onClick}
    >
      <Icon aria-hidden />
    </Button>
  );
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(listener: () => void): () => void {
  if (typeof window.matchMedia !== "function") {
    return () => {};
  }
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function getPrefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function FontSizeControls({ fontSize, compact = false }: { fontSize: number; compact?: boolean }) {
  function change(next: number): void {
    readerPreferencesStore.update({ fontSize: clampFontSize(next) });
  }

  if (compact) {
    // Uma linha discreta ao lado da aba da cifra; os rótulos acessíveis são os mesmos.
    return (
      <div role="group" aria-label="Tamanho da fonte" className="flex items-center gap-1 text-sm">
        <Button
          variant="ghost"
          size="icon-lg"
          className={cn("size-9", DISABLED_LOOK)}
          aria-label="Diminuir fonte"
          focusableWhenDisabled
          disabled={fontSize <= MIN_FONT_SIZE}
          onClick={() => change(fontSize - FONT_SIZE_STEP)}
        >
          <Minus aria-hidden />
        </Button>
        <output aria-live="polite" className="flex min-w-14 items-center justify-center gap-1 font-medium">
          <Type className="size-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Fonte:</span>
          {fontSize}
          <span aria-hidden> px</span>
        </output>
        <Button
          variant="ghost"
          size="icon-lg"
          className={cn("size-9", DISABLED_LOOK)}
          aria-label="Aumentar fonte"
          focusableWhenDisabled
          disabled={fontSize >= MAX_FONT_SIZE}
          onClick={() => change(fontSize + FONT_SIZE_STEP)}
        >
          <Plus aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div role="group" aria-label="Tamanho da fonte" className="flex flex-wrap items-center gap-2">
      <StepButton
        label="Diminuir fonte"
        icon={Minus}
        disabled={fontSize <= MIN_FONT_SIZE}
        onClick={() => change(fontSize - FONT_SIZE_STEP)}
      />
      <output aria-live="polite" className="flex min-w-24 items-center justify-center gap-1.5 text-sm font-medium">
        <Type className="size-4 text-muted-foreground" aria-hidden />
        <span className="sr-only">Fonte:</span>
        {fontSize} px
      </output>
      <StepButton
        label="Aumentar fonte"
        icon={Plus}
        disabled={fontSize >= MAX_FONT_SIZE}
        onClick={() => change(fontSize + FONT_SIZE_STEP)}
      />
      <Button
        variant="ghost"
        size="lg"
        className={cn("h-10 px-3", DISABLED_LOOK)}
        focusableWhenDisabled
        disabled={fontSize === DEFAULT_FONT_SIZE}
        onClick={() => change(DEFAULT_FONT_SIZE)}
      >
        <RotateCcw data-icon="inline-start" aria-hidden />
        Restaurar tamanho padrão
      </Button>
    </div>
  );
}

interface ScrollSpeedControlsProps {
  speed: number;
  onScrollToTop: () => void;
}

export function ScrollSpeedControls({ speed, onScrollToTop }: ScrollSpeedControlsProps) {
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getPrefersReducedMotion,
    () => false,
  );

  function change(next: number): void {
    readerPreferencesStore.update({ scrollSpeed: clampScrollSpeed(next) });
  }

  return (
    <div>
      <div role="group" aria-label="Rolagem automática" className="flex flex-wrap items-center gap-2">
        <StepButton
          label="Diminuir velocidade"
          icon={Minus}
          disabled={speed <= MIN_SCROLL_SPEED}
          onClick={() => change(speed - SCROLL_SPEED_STEP)}
        />
        <output aria-live="polite" className="flex min-w-24 items-center justify-center gap-1.5 text-sm font-medium">
          <Gauge className="size-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Velocidade:</span>
          {speed} px/s
        </output>
        <StepButton
          label="Aumentar velocidade"
          icon={Plus}
          disabled={speed >= MAX_SCROLL_SPEED}
          onClick={() => change(speed + SCROLL_SPEED_STEP)}
        />
        <Button variant="ghost" size="lg" className="h-10 px-3" onClick={onScrollToTop}>
          <ChevronsUp data-icon="inline-start" aria-hidden />
          Voltar ao início
        </Button>
      </div>
      {prefersReducedMotion && (
        <p className="mt-2 text-sm text-muted-foreground">
          Seu sistema pede menos movimento. A rolagem automática é opcional e nunca começa sozinha;
          velocidades menores movimentam menos a tela.
        </p>
      )}
    </div>
  );
}

/**
 * Cifra ou Letra. A escolha vale para o leitor e para a apresentação desta pessoa, neste
 * navegador; o tom e a posição de leitura não mudam ao alternar.
 */
export function ReadingModeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { readingMode } = useSyncExternalStore(
    readerPreferencesStore.subscribe,
    readerPreferencesStore.getSnapshot,
    readerPreferencesStore.getServerSnapshot,
  );
  return (
    <div role="group" aria-label="Modo de leitura" className={cn("inline-flex rounded-lg border bg-background/60 p-0.5", className)}>
      {READING_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={readingMode === mode}
          onClick={() => readerPreferencesStore.update({ readingMode: mode })}
          className={cn(
            "rounded-md px-3 font-medium transition-colors aria-pressed:bg-primary aria-pressed:text-primary-foreground",
            compact ? "h-8 text-sm" : "h-9 text-sm",
            readingMode !== mode && "text-muted-foreground hover:text-foreground",
          )}
        >
          {READING_MODE_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}
