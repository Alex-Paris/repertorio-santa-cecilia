"use client";

import { useDeferredValue } from "react";

import { FormField, getFieldA11yProps } from "@/components/layout/form-field";
import { Textarea } from "@/components/ui/textarea";

import { ChordSheet } from "./chord-sheet";

interface ChordProEditorProps {
  id: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

const PLACEHOLDER = "[G]Hoje vou se[D]guir\n[Em]Por um novo [C]lugar";

export function ChordProEditor({ id, value, error, onChange }: ChordProEditorProps) {
  const deferredValue = useDeferredValue(value);
  const hasContent = deferredValue.trim() !== "";

  return (
    <div className="space-y-4">
      <FormField
        id={id}
        label="Cifra (ChordPro)"
        error={error}
        hint="Escreva cada acorde entre colchetes, antes da sílaba em que ele entra."
      >
        <Textarea
          {...getFieldA11yProps(id, error)}
          name="chordPro"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="min-h-56 font-mono md:text-sm"
        />
      </FormField>

      <section aria-label="Prévia da cifra">
        <h2 className="mb-1.5 text-sm font-medium">Prévia</h2>
        <div className="rounded-xl border bg-card p-5 md:p-8">
          {hasContent ? (
            <ChordSheet source={deferredValue} />
          ) : (
            <p className="text-sm text-muted-foreground">A cifra interpretada aparece aqui.</p>
          )}
        </div>
      </section>
    </div>
  );
}
