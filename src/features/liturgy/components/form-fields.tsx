"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";

import { FormError } from "@/components/layout/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { normalizeText } from "@/lib/utils/normalize-text";

import {
  BIBLE_BOOKS,
  formatScriptureReference,
  sameScriptureReference,
  scriptureReferenceSchema,
  type BibleBookId,
  type ScriptureReference,
} from "../domain/scripture";
import { MAX_SCRIPTURE_REFERENCES } from "../domain/classification";

export interface ChoiceGroupProps<T extends string> {
  legend: string;
  hint?: string;
  options: readonly { id: T; label: string }[];
  selected: readonly T[];
  onChange: (next: T[]) => void;
  /** Mostra um campo de pesquisa: para listas longas. */
  searchable?: boolean;
  disabled?: boolean;
}

/** Seleção múltipla por caixas de marcação, com pesquisa opcional. */
export function ChoiceGroup<T extends string>({ legend, hint, options, selected, onChange, searchable, disabled }: ChoiceGroupProps<T>) {
  const searchId = useId();
  const [filter, setFilter] = useState("");
  const needle = normalizeText(filter);
  // Os já marcados continuam visíveis durante a pesquisa, para poderem ser desmarcados.
  const visible = options.filter(
    (option) => !needle || selected.includes(option.id) || normalizeText(option.label).includes(needle),
  );

  function toggle(id: T, checked: boolean): void {
    onChange(checked ? [...selected, id] : selected.filter((value) => value !== id));
  }

  return (
    <fieldset disabled={disabled} className="space-y-2 rounded-xl border p-4 disabled:opacity-60">
      <legend className="px-1 text-sm font-medium">
        {legend}
        {selected.length > 0 && <span className="font-normal text-muted-foreground"> ({selected.length})</span>}
      </legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {searchable && (
        <>
          <label htmlFor={searchId} className="sr-only">
            Pesquisar em {legend}
          </label>
          <Input
            id={searchId}
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={`Pesquisar em ${legend.toLowerCase()}`}
            className="h-9"
          />
        </>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {visible.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={selected.includes(option.id)}
              onChange={(event) => toggle(option.id, event.target.checked)}
            />
            {option.label}
          </label>
        ))}
        {visible.length === 0 && <p className="text-sm text-muted-foreground">Nada encontrado.</p>}
      </div>
    </fieldset>
  );
}

interface ChipGroupProps<T extends string> {
  legend: string;
  hint?: string;
  options: readonly { id: T; label: string }[];
  selected: readonly T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
}

/** Seleção múltipla com um toque por opção, para listas curtas (momentos, tempos). */
export function ChipGroup<T extends string>({ legend, hint, options, selected, onChange, disabled }: ChipGroupProps<T>) {
  return (
    <fieldset disabled={disabled} className="space-y-2 rounded-xl border p-4 disabled:opacity-60">
      <legend className="px-1 text-sm font-medium">
        {legend}
        {selected.length > 0 && <span className="font-normal text-muted-foreground"> ({selected.length})</span>}
      </legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const pressed = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={pressed}
              onClick={() => onChange(pressed ? selected.filter((value) => value !== option.id) : [...selected, option.id])}
              className="inline-flex min-h-9 items-center rounded-full border bg-card px-3 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground disabled:cursor-not-allowed"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export interface ScriptureFieldProps {
  references: ScriptureReference[];
  onChange: (next: ScriptureReference[]) => void;
  legend?: string;
  max?: number;
}

/** Referências estruturadas (livro, capítulo, versículos), comparáveis com as leituras. */
export function ScriptureField({
  references,
  onChange,
  legend = "Referências bíblicas",
  max = MAX_SCRIPTURE_REFERENCES,
}: ScriptureFieldProps) {
  const id = useId();
  const [book, setBook] = useState<BibleBookId>("sl");
  const [chapter, setChapter] = useState("");
  const [verseStart, setVerseStart] = useState("");
  const [verseEnd, setVerseEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add(): void {
    const parsed = scriptureReferenceSchema.safeParse({
      book,
      chapter: Number(chapter),
      ...(verseStart ? { verseStart: Number(verseStart) } : {}),
      ...(verseEnd ? { verseEnd: Number(verseEnd) } : {}),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Referência inválida.");
      return;
    }
    if (references.some((reference) => sameScriptureReference(reference, parsed.data))) {
      setError("Esta referência já foi adicionada.");
      return;
    }
    if (references.length >= max) {
      setError(`Use no máximo ${max} referências bíblicas.`);
      return;
    }
    setError(null);
    onChange([...references, parsed.data]);
    setChapter("");
    setVerseStart("");
    setVerseEnd("");
  }

  return (
    <fieldset className="space-y-3 rounded-xl border p-4">
      <legend className="px-1 text-sm font-medium">{legend}</legend>
      <p className="text-xs text-muted-foreground">
        Salmos na numeração das Bíblias atuais (hebraica): o Salmo 22(23) é o capítulo 23. Sem versículos, vale o
        capítulo inteiro.
      </p>
      {references.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {references.map((reference) => {
            const label = formatScriptureReference(reference);
            return (
              <li key={label} className="flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-3 text-sm">
                {label}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover ${label}`}
                  onClick={() => onChange(references.filter((candidate) => candidate !== reference))}
                >
                  <X aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <label htmlFor={`${id}-livro`} className="col-span-2 space-y-1 text-xs font-medium text-muted-foreground sm:col-span-1">
          Livro
          <NativeSelect
            id={`${id}-livro`}
            value={book}
            onChange={(event) => setBook(event.target.value as BibleBookId)}
            className="w-full"
          >
            {BIBLE_BOOKS.map(([bookId, , name]) => (
              <NativeSelectOption key={bookId} value={bookId}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label htmlFor={`${id}-capitulo`} className="space-y-1 text-xs font-medium text-muted-foreground">
          Capítulo
          <Input id={`${id}-capitulo`} inputMode="numeric" value={chapter} onChange={(event) => setChapter(event.target.value)} className="h-10" />
        </label>
        <label htmlFor={`${id}-inicio`} className="space-y-1 text-xs font-medium text-muted-foreground">
          Versículo inicial
          <Input id={`${id}-inicio`} inputMode="numeric" value={verseStart} onChange={(event) => setVerseStart(event.target.value)} className="h-10" />
        </label>
        <label htmlFor={`${id}-fim`} className="space-y-1 text-xs font-medium text-muted-foreground">
          Versículo final
          <Input id={`${id}-fim`} inputMode="numeric" value={verseEnd} onChange={(event) => setVerseEnd(event.target.value)} className="h-10" />
        </label>
      </div>
      {error && <FormError message={error} />}
      <Button type="button" variant="outline" size="lg" className="h-10 px-4" onClick={add}>
        Adicionar referência
      </Button>
    </fieldset>
  );
}

