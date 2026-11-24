"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { CELEBRATION_PRESETS } from "../../data/celebration-presets";
import { celebrationDisplayTitle, formatShortDate } from "../../domain/calendar";
import type { CelebrationInput } from "../../domain/celebration-record";

interface CelebrationPrefillProps {
  pending: boolean;
  dirty: boolean;
  onApply: (input: CelebrationInput) => void;
}

export function CelebrationPrefill({ pending, dirty, onApply }: CelebrationPrefillProps) {
  const [selectedId, setSelectedId] = useState("");
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function apply(id: string): void {
    const preset = CELEBRATION_PRESETS.find((entry) => entry.id === id);
    if (!preset || pending) return;
    onApply(structuredClone(preset.input));
    setReplacementId(null);
    setNotice(`${celebrationDisplayTitle(preset.input)}: formulário preenchido. Confira os dados e as fontes antes de criar a celebração.`);
  }

  function requestApply(): void {
    if (!selectedId || pending) return;
    if (dirty) setReplacementId(selectedId);
    else apply(selectedId);
  }

  return (
    <section aria-labelledby="preencher-celebracao" className="max-w-2xl space-y-3 rounded-xl border bg-card p-4">
      <h2 id="preencher-celebracao" className="font-display text-lg font-semibold">Começar pela data</h2>
      <p className="text-sm text-muted-foreground">
        Carregue os dados preparados para evitar digitar as leituras e as fontes. Você pode ajustar tudo antes de salvar.
      </p>
      <fieldset disabled={pending} className="min-w-0 space-y-3">
        <label className="block space-y-1 text-sm font-medium">
          Escolha uma celebração preparada
          <NativeSelect
            value={selectedId}
            onChange={(event) => { setSelectedId(event.target.value); setReplacementId(null); setNotice(null); }}
            className="w-full min-w-0 [&_select]:h-11"
          >
            <NativeSelectOption value="">Selecione a data e a celebração</NativeSelectOption>
            {CELEBRATION_PRESETS.map((entry) => (
              <NativeSelectOption key={entry.id} value={entry.id}>
                {formatShortDate(entry.input.date)} — {celebrationDisplayTitle(entry.input)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <Button type="button" variant="outline" size="lg" className="h-11" disabled={!selectedId || pending} onClick={requestApply}>
          Preencher formulário
        </Button>
        {replacementId && (
          <div className="space-y-2 rounded-lg border p-3">
            <p role="alert" className="text-sm">Há alterações não salvas no formulário. Substituir pelo preenchimento escolhido?</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => apply(replacementId)}>Substituir preenchimento</Button>
              <Button type="button" variant="outline" onClick={() => setReplacementId(null)}>Manter alterações</Button>
            </div>
          </div>
        )}
      </fieldset>
      {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
      <p className="text-xs text-muted-foreground">
        Ainda não temos todas as datas. Se a sua não estiver na lista, preencha o formulário abaixo. A celebração será criada em revisão.
      </p>
    </section>
  );
}
