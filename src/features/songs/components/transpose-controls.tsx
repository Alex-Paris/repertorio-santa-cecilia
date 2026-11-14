"use client";

import { cn } from "cn";
import { Minus, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { MusicalKey } from "../domain/musical-key";
import {
  clampTransposeSemitones,
  formatSemitoneOffset,
  MAX_TRANSPOSE_SEMITONES,
  MIN_TRANSPOSE_SEMITONES,
  transposeKey,
} from "../domain/transposition";

interface TransposeControlsProps {
  originalKey: MusicalKey;
  semitones: number;
  onChange: (semitones: number) => void;
  hint?: string;
  className?: string;
  /** Versão de uma linha para o leitor do catálogo: botões menores e restauração só com ícone. */
  compact?: boolean;
}

// Com `focusableWhenDisabled`, o botão mantém o foco do teclado ao atingir um limite.
export const DISABLED_LOOK = "aria-disabled:pointer-events-none aria-disabled:opacity-50";

export function TransposeControls({
  originalKey,
  semitones,
  onChange,
  hint,
  className,
  compact = false,
}: TransposeControlsProps) {
  function change(next: number): void {
    const clamped = clampTransposeSemitones(next);
    if (clamped !== semitones) {
      onChange(clamped);
    }
  }

  if (compact) {
    return (
      <div className={className}>
        <div role="group" aria-label="Tom de leitura" className="flex items-center gap-2 text-sm">
          <span aria-hidden>Transpor:</span>
          <span className="flex items-center rounded-full border bg-background/70">
            <Button
              variant="ghost"
              size="icon-lg"
              className={cn("size-9 rounded-full", DISABLED_LOOK)}
              aria-label="Diminuir um semitom"
              focusableWhenDisabled
              disabled={semitones <= MIN_TRANSPOSE_SEMITONES}
              onClick={() => change(semitones - 1)}
            >
              <Minus aria-hidden />
            </Button>
            <output aria-live="polite" className="min-w-12 text-center font-medium">
              <span className="sr-only">Tom: </span>
              <span className="font-mono text-base font-semibold text-chord">{transposeKey(originalKey, semitones)}</span>
              {semitones !== 0 && <span className="ml-1 text-xs text-muted-foreground">({formatSemitoneOffset(semitones)})</span>}
            </output>
            <Button
              variant="ghost"
              size="icon-lg"
              className={cn("size-9 rounded-full", DISABLED_LOOK)}
              aria-label="Aumentar um semitom"
              focusableWhenDisabled
              disabled={semitones >= MAX_TRANSPOSE_SEMITONES}
              onClick={() => change(semitones + 1)}
            >
              <Plus aria-hidden />
            </Button>
          </span>
          {semitones !== 0 && (
            <Button
              variant="ghost"
              size="icon-lg"
              className="size-9"
              aria-label="Restaurar tom original"
              onClick={() => change(0)}
            >
              <RotateCcw aria-hidden />
            </Button>
          )}
        </div>
        {hint && <p className={cn("mt-1 text-xs text-muted-foreground", semitones === 0 && "sr-only")}>{hint}</p>}
      </div>
    );
  }

  return (
    <div className={className}>
      <div role="group" aria-label="Tom de leitura" className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon-lg"
          className={cn("size-10", DISABLED_LOOK)}
          aria-label="Diminuir um semitom"
          focusableWhenDisabled
          disabled={semitones <= MIN_TRANSPOSE_SEMITONES}
          onClick={() => change(semitones - 1)}
        >
          <Minus aria-hidden />
        </Button>

        <output aria-live="polite" className="min-w-24 px-1 text-center text-sm font-medium">
          Tom:{" "}
          <span className="font-mono text-base font-semibold text-chord">
            {transposeKey(originalKey, semitones)}
          </span>
          {semitones !== 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({formatSemitoneOffset(semitones)})
            </span>
          )}
        </output>

        <Button
          variant="outline"
          size="icon-lg"
          className={cn("size-10", DISABLED_LOOK)}
          aria-label="Aumentar um semitom"
          focusableWhenDisabled
          disabled={semitones >= MAX_TRANSPOSE_SEMITONES}
          onClick={() => change(semitones + 1)}
        >
          <Plus aria-hidden />
        </Button>

        <Button
          variant="ghost"
          size="lg"
          className={cn("h-10 px-3", DISABLED_LOOK)}
          focusableWhenDisabled
          disabled={semitones === 0}
          onClick={() => change(0)}
        >
          <RotateCcw data-icon="inline-start" aria-hidden />
          Restaurar tom original
        </Button>
      </div>
      {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
