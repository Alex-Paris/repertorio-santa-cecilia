"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { FormError } from "@/components/layout/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getLibraryErrorMessage, LibraryError } from "@/features/library/domain/library-errors";

import { CELEBRATION_PRESETS } from "../../data/celebration-presets";
import { CELEBRATION_RANKS, CELEBRATION_RANK_LABELS, READING_ROLE_LABELS, celebrationDisplayTitle, formatShortDate, isValidIsoDate, todayInBrazil, type CelebrationRank } from "../../domain/calendar";
import { celebrationInputSchema, type CelebrationInput } from "../../domain/celebration-record";
import type { LiturgyPrefill } from "../../domain/prefill";

interface CelebrationPrefillProps {
  pending: boolean;
  dirty: boolean;
  loadByDate: (date: string, signal?: AbortSignal) => Promise<LiturgyPrefill>;
  onApply: (input: CelebrationInput) => void;
}

export function CelebrationPrefill({ pending, dirty, loadByDate, onApply }: CelebrationPrefillProps) {
  const [date, setDate] = useState(todayInBrazil);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<LiturgyPrefill | null>(null);
  const [rank, setRank] = useState<CelebrationRank | "">("");
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [replacement, setReplacement] = useState<CelebrationInput | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  function changeDate(next: string): void {
    controller.current?.abort();
    setLoading(false);
    setDate(next);
    setPreview(null);
    setRank("");
    setError(null);
    setReplacement(null);
    setNotice(null);
  }

  async function lookup(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (pending || loading) return;
    setPreview(null);
    setError(null);
    setReplacement(null);
    setNotice(null);
    if (!isValidIsoDate(date)) { setError("Informe uma data válida."); return; }
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    try {
      const result = await loadByDate(date, current.signal);
      if (!current.signal.aborted) { setPreview(result); setRank(result.draft.rank ?? ""); }
    } catch (caught) {
      if (!current.signal.aborted) {
        setError(caught instanceof LibraryError && caught.code === "remote-unavailable"
          ? "Não foi possível consultar a liturgia agora. Tente novamente em instantes ou use os dados preparados."
          : getLibraryErrorMessage(caught));
      }
    } finally { if (!current.signal.aborted) setLoading(false); }
  }

  function apply(input: CelebrationInput): void {
    if (pending) return;
    onApply(structuredClone(input));
    setReplacement(null);
    setNotice(`${celebrationDisplayTitle(input)}: formulário preenchido. Confira os dados e as fontes antes de criar a celebração.`);
  }

  function requestApply(input: CelebrationInput): void {
    if (pending) return;
    if (dirty) setReplacement(input);
    else apply(input);
  }

  function applyConsulted(): void {
    if (!preview) return;
    const result = celebrationInputSchema.safeParse({ ...preview.draft, rank });
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Confira os dados consultados."); return; }
    setError(null);
    requestApply(result.data);
  }

  function applyPrepared(): void {
    const preset = CELEBRATION_PRESETS.find((entry) => entry.id === selectedId);
    if (!preset || pending) return;
    controller.current?.abort();
    setLoading(false);
    setPreview(null);
    setError(null);
    requestApply(preset.input);
  }

  return (
    <section aria-labelledby="preencher-celebracao" className="surface-panel max-w-4xl space-y-4 p-4 sm:p-6">
      <h2 id="preencher-celebracao" className="font-display text-xl font-semibold">Começar pela data</h2>
      <p className="text-sm text-muted-foreground">Escolha a data para buscar a celebração e as referências das leituras. Confira o resultado e use-o para preencher o formulário.</p>
      <form onSubmit={(event) => void lookup(event)} aria-label="Consultar liturgia" className="space-y-2">
        <label className="block space-y-1 text-sm font-medium">
          Buscar liturgia por data
          <Input type="date" required value={date} onChange={(event) => changeDate(event.target.value)} disabled={pending} className="h-11 w-full sm:w-auto" />
        </label>
        <Button type="submit" size="lg" className="h-11" disabled={pending || loading} aria-busy={loading}>
          {loading ? "Buscando liturgia…" : "Buscar liturgia"}
        </Button>
      </form>
      {error && <FormError message={error} />}
      {preview && (
        <div className="space-y-3 rounded-xl border bg-surface-alt/50 p-4" aria-label="Liturgia consultada" role="region">
          <p className="font-display font-semibold">{preview.draft.title}</p>
          <p className="text-sm text-muted-foreground">{formatShortDate(preview.draft.date)}</p>
          <ul className="space-y-1 text-sm">
            {preview.draft.readings.map((reading) => <li key={reading.role}>{READING_ROLE_LABELS[reading.role]}: {reading.citation}</li>)}
            {preview.draft.unverifiedReadings.map((role) => <li key={role}>{READING_ROLE_LABELS[role]}: precisa de conferência e preenchimento.</li>)}
          </ul>
          {preview.draft.rank === null && (
            <label className="block space-y-1 text-sm font-medium">
              Grau da celebração
              <NativeSelect value={rank} disabled={pending} onChange={(event) => { setRank(event.target.value as CelebrationRank); setReplacement(null); }} className="w-full min-w-0">
                <NativeSelectOption value="">Escolha o grau após conferir a fonte</NativeSelectOption>
                {CELEBRATION_RANKS.map((value) => <NativeSelectOption key={value} value={value}>{CELEBRATION_RANK_LABELS[value]}</NativeSelectOption>)}
              </NativeSelect>
            </label>
          )}
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
          {preview.draft.sources.map((source) => (
            <a key={source.id} href={source.referenceUrl} target="_blank" rel="noopener noreferrer" className="block text-sm underline underline-offset-3">
              Consultar fonte: {source.provider}<span className="sr-only"> (abre em nova aba)</span>
            </a>
          ))}
          <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal" disabled={pending || !rank} onClick={applyConsulted}>Usar dados consultados</Button>
        </div>
      )}
      <details className="border-t pt-3">
        <summary className="cursor-pointer text-sm font-medium">Usar uma celebração já preparada</summary>
        <fieldset disabled={pending} className="mt-3 min-w-0 space-y-3">
          <label className="block space-y-1 text-sm font-medium">
            Escolha uma celebração preparada
            <NativeSelect value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setReplacement(null); setNotice(null); }} className="w-full min-w-0 [&_select]:h-11">
              <NativeSelectOption value="">Selecione a data e a celebração</NativeSelectOption>
              {CELEBRATION_PRESETS.map((entry) => <NativeSelectOption key={entry.id} value={entry.id}>{formatShortDate(entry.input.date)} — {celebrationDisplayTitle(entry.input)}</NativeSelectOption>)}
            </NativeSelect>
          </label>
          <Button type="button" variant="outline" size="lg" className="h-11" disabled={!selectedId || pending} onClick={applyPrepared}>Preencher formulário</Button>
        </fieldset>
      </details>
      {replacement && (
        <div className="space-y-2 rounded-lg border p-3">
          <p role="alert" className="text-sm">Há alterações não salvas no formulário. Substituir pelo preenchimento escolhido?</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending} onClick={() => apply(replacement)}>Substituir preenchimento</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setReplacement(null)}>Manter alterações</Button>
          </div>
        </div>
      )}
      {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
      <p className="text-xs text-muted-foreground">A consulta depende das datas disponibilizadas pela fonte. Carregar dados não salva nem aprova: a celebração será criada em revisão ao enviar o formulário abaixo.</p>
    </section>
  );
}
