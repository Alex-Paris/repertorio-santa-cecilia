"use client";

import { cn } from "cn";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormError } from "@/components/layout/form-error";
import { FormField, getFieldA11yProps } from "@/components/layout/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RevisionConflict } from "@/features/library/components/revision-conflict";
import { useSessionDraft } from "@/features/library/components/use-library";
import { repertoireRepository } from "@/features/library/data/browser-library";
import { getLibraryErrorMessage, LibraryError } from "@/features/library/domain/library-errors";
import { showToast } from "@/lib/utils/toast";

import type { Repertoire, RepertoireMass } from "../domain/repertoire";
import {
  EMPTY_REPERTOIRE_FORM,
  parseRepertoireForm,
  type RepertoireFormErrors,
  type RepertoireFormValues,
} from "../services/repertoire-form";

interface MassFields {
  enabled: boolean;
  date: string;
  title: string;
}

function toMassFields(mass: RepertoireMass | undefined): MassFields {
  return { enabled: mass !== undefined, date: mass?.date ?? "", title: mass?.title ?? "" };
}

/**
 * O que enviar sobre a missa: nada quando o repertório nunca teve uma (o servidor mantém como
 * está), `null` para desvincular, ou os dados informados.
 */
function toMassInput(fields: MassFields, saved: RepertoireMass | undefined): { mass?: RepertoireMass | null } {
  if (!fields.enabled) {
    return saved ? { mass: null } : {};
  }
  // A referência à celebração da base só vale enquanto a data for a mesma.
  const keep = saved?.date === fields.date;
  return {
    mass: {
      date: fields.date,
      title: fields.title,
      ...(keep && saved.celebrationId ? { celebrationId: saved.celebrationId } : {}),
      ...(keep && saved.celebrationRevision ? { celebrationRevision: saved.celebrationRevision } : {}),
    },
  };
}

export function RepertoireForm({ repertoire }: { repertoire?: Repertoire }) {
  const router = useRouter();
  const [initialValues, setInitialValues] = useState<RepertoireFormValues>(() =>
    repertoire
      ? { name: repertoire.name, description: repertoire.description }
      : EMPTY_REPERTOIRE_FORM,
  );
  const [values, setValues] = useState(initialValues);
  const [savedMass, setSavedMass] = useState(repertoire?.mass);
  const [mass, setMass] = useState<MassFields>(() => toMassFields(repertoire?.mass));
  const [baseRevision, setBaseRevision] = useState(repertoire?.revision);
  const [conflict, setConflict] = useState(false);
  const [errors, setErrors] = useState<RepertoireFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const initialMass = toMassFields(savedMass);
  useSessionDraft(
    values.name !== initialValues.name ||
      values.description !== initialValues.description ||
      mass.enabled !== initialMass.enabled ||
      mass.date !== initialMass.date ||
      mass.title !== initialMass.title,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaveError(null);
    setConflict(false);

    const parsed = parseRepertoireForm({ ...values, ...toMassInput(mass, savedMass) });
    if (!parsed.success) {
      setErrors(parsed.errors);
      event.currentTarget
        .querySelector<HTMLElement>(parsed.errors.name ? "[name='name']" : "[name='massDate']")
        ?.focus();
      return;
    }

    setSaving(true);
    try {
      const saved = repertoire
        ? await repertoireRepository.update(
            repertoire.id,
            parsed.input,
            baseRevision ?? repertoire.revision,
          )
        : await repertoireRepository.create(parsed.input);

      showToast(repertoire ? "Repertório atualizado." : "Repertório criado.");
      if (!repertoire) {
        setValues(EMPTY_REPERTOIRE_FORM);
      }
      router.push(`/repertorios/${saved.id}`);
    } catch (error) {
      if (error instanceof LibraryError && error.code === "revision-conflict") {
        setConflict(true);
      } else {
        setSaveError(getLibraryErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormField id="repertoire-name" label="Nome" error={errors.name}>
        <Input
          {...getFieldA11yProps("repertoire-name", errors.name)}
          name="name"
          value={values.name}
          onChange={(event) => {
            setValues((current) => ({ ...current, name: event.target.value }));
            setErrors((current) => ({ ...current, name: undefined }));
          }}
          className="h-10"
        />
      </FormField>

      <FormField id="repertoire-description" label="Descrição (opcional)" error={errors.description}>
        <Textarea
          {...getFieldA11yProps("repertoire-description", errors.description)}
          name="description"
          value={values.description}
          onChange={(event) =>
            setValues((current) => ({ ...current, description: event.target.value }))
          }
          className="min-h-24"
        />
      </FormField>

      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">Missa (opcional)</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={mass.enabled}
            onChange={(event) => {
              setMass((current) => ({ ...current, enabled: event.target.checked }));
              setErrors((current) => ({ ...current, mass: undefined }));
            }}
          />
          Este repertório é para uma missa
        </label>
        {mass.enabled ? (
          <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
            <label className="space-y-1 text-sm font-medium">
              Data da celebração
              <Input
                type="date"
                name="massDate"
                value={mass.date}
                onChange={(event) => {
                  setMass((current) => ({ ...current, date: event.target.value }));
                  setErrors((current) => ({ ...current, mass: undefined }));
                }}
                className="h-10"
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Celebração
              <Input
                name="massTitle"
                value={mass.title}
                maxLength={300}
                placeholder="Ex.: 3º Domingo do Advento"
                onChange={(event) => {
                  setMass((current) => ({ ...current, title: event.target.value }));
                  setErrors((current) => ({ ...current, mass: undefined }));
                }}
                className="h-10"
              />
            </label>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Repertórios de ensaio ou de apresentação não precisam de uma missa.
          </p>
        )}
        {errors.mass && <FormError message={errors.mass} />}
      </fieldset>

      {conflict && repertoire && (
        <RevisionConflict
          message="Este repertório foi alterado em outro dispositivo enquanto você o editava."
          loadCurrent={() => repertoireRepository.findById(repertoire.id)}
          renderCurrent={(current) => (
            <div className="space-y-1">
              <p className="font-medium wrap-break-word">{current.name}</p>
              <p className="text-muted-foreground whitespace-pre-line wrap-break-word">
                {current.description || "Sem descrição."}
              </p>
            </div>
          )}
          missingCode="repertoire-not-found"
          draftText={`Nome: ${values.name}\n\n${values.description}`}
          onDiscard={(current) => {
            const next = { name: current.name, description: current.description };
            setInitialValues(next);
            setValues(next);
            setSavedMass(current.mass);
            setMass(toMassFields(current.mass));
            setErrors({});
            setBaseRevision(current.revision);
            setConflict(false);
          }}
        />
      )}
      {saveError && <FormError message={saveError} />}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={saving} className="h-10 px-4">
          {saving ? "Salvando…" : "Salvar repertório"}
        </Button>
        <Link
          href={repertoire ? `/repertorios/${repertoire.id}` : "/repertorios"}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
