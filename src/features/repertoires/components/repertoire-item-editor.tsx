"use client";

import { useState, type FormEvent } from "react";

import { FormField, getFieldA11yProps } from "@/components/layout/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useSessionDraft } from "@/features/library/components/use-library";
import { repertoireRepository } from "@/features/library/data/browser-library";
import { getLibraryErrorMessage, LibraryError } from "@/features/library/domain/library-errors";
import { LITURGICAL_MOMENTS, type LiturgicalMomentId } from "@/features/liturgy/domain/vocabulary";
import { transposableKey, type Revision } from "@/features/songs/domain/song";
import { TransposeControls } from "@/features/songs/components/transpose-controls";
import { showToast } from "@/lib/utils/toast";

import type { RepertoireId } from "../domain/repertoire";
import { MAX_ITEM_NOTES_LENGTH } from "../domain/repertoire-schema";
import { parseRepertoireItemNotes } from "../services/repertoire-form";
import type { RepertoireEntry } from "../services/repertoire-service";
import { saveSemitones, useItemSemitones, useItemSemitonesSaving } from "./save-item-semitones";

interface RepertoireItemEditorProps {
  repertoireId: RepertoireId;
  /** Revisão atual do repertório; muda quando a lista é recarregada. */
  revision: Revision;
  entry: RepertoireEntry;
  /** Mostra a escolha do momento da missa. */
  showMoment?: boolean;
  onClose: () => void;
}

export function RepertoireItemEditor({ repertoireId, revision, entry, showMoment = false, onClose }: RepertoireItemEditorProps) {
  const { item, song } = entry;
  const fieldId = `notes-${item.id}`;
  const [notes, setNotes] = useState(item.notes ?? "");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);

  useSessionDraft(notes !== (item.notes ?? ""));
  const reference = { repertoireId, itemId: item.id };
  const semitones = useItemSemitones(reference, item.transposeSemitones);
  const savingSemitones = useItemSemitonesSaving(reference);

  const [savingMoment, setSavingMoment] = useState(false);

  /** Salvo na hora, como o tom. O momento não muda a posição: a ordem é decisão de quem monta. */
  async function changeMoment(value: string): Promise<void> {
    setSavingMoment(true);
    try {
      await repertoireRepository.updateItem(
        repertoireId,
        item.id,
        { moment: value ? (value as LiturgicalMomentId) : null },
        revision,
      );
    } catch (caught) {
      showToast(getLibraryErrorMessage(caught), "error");
    } finally {
      setSavingMoment(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const parsed = parseRepertoireItemNotes(notes);
    if (!parsed.success) {
      setError(parsed.error);
      return;
    }

    setSaving(true);
    setError(undefined);
    try {
      // Depois de um conflito, a revisão já é a da versão recarregada: a pessoa refaz sobre ela.
      await repertoireRepository.updateItem(repertoireId, item.id, { notes: parsed.notes }, revision);
      showToast("Anotações salvas.");
      onClose();
    } catch (caught) {
      if (caught instanceof LibraryError && caught.code === "revision-conflict") {
        setConflict(true);
      } else {
        setError(getLibraryErrorMessage(caught));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {showMoment && (
        <div className="space-y-1">
          <label htmlFor={`moment-${item.id}`} className="block text-sm font-medium">
            Momento da missa
          </label>
          <NativeSelect
            id={`moment-${item.id}`}
            value={item.moment ?? ""}
            disabled={savingMoment}
            onChange={(event) => void changeMoment(event.target.value)}
            className="w-full sm:w-72"
          >
            <NativeSelectOption value="">Sem momento definido</NativeSelectOption>
            {LITURGICAL_MOMENTS.map((moment) => (
              <NativeSelectOption key={moment.id} value={moment.id}>
                {moment.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">Salvo automaticamente, somente neste repertório.</p>
        </div>
      )}
      {song && transposableKey(song) && (
        <TransposeControls
          originalKey={transposableKey(song) as NonNullable<ReturnType<typeof transposableKey>>}
          semitones={semitones}
          onChange={(next) => void saveSemitones(repertoireId, item.id, next, revision)}
          hint={
            savingSemitones
              ? "Salvando o tom…"
              : "Salvo automaticamente, somente neste repertório."
          }
        />
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <FormField
          id={fieldId}
          label="Anotações"
          error={error}
          hint={`${notes.trim().length} de ${MAX_ITEM_NOTES_LENGTH} caracteres. Valem só para este repertório.`}
        >
          <Textarea
            {...getFieldA11yProps(fieldId, error)}
            name="notes"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setError(undefined);
            }}
            placeholder="Ex.: repetir o refrão duas vezes"
            className="min-h-20"
          />
        </FormField>

        {conflict && (
          <div role="alert" className="space-y-1 rounded-lg border border-destructive/40 p-3 text-sm">
            <p className="font-medium">
              O repertório foi alterado em outro dispositivo ou aba enquanto você editava.
            </p>
            <p className="text-muted-foreground">
              Sua anotação não foi salva e continua no campo. Anotação atual salva:{" "}
              {item.notes ? `“${item.notes}”` : "nenhuma"}. Confira e salve de novo para aplicar
              sobre a versão atual.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" disabled={saving} className="h-10 px-4">
            {saving ? "Salvando…" : conflict ? "Salvar sobre a versão atual" : "Salvar anotações"}
          </Button>
          <Button type="button" variant="outline" size="lg" className="h-10 px-4" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </form>
    </div>
  );
}
