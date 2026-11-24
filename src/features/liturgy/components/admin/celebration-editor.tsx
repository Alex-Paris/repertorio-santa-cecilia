"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";

import { FormError } from "@/components/layout/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import {
  CELEBRATION_RANK_LABELS,
  CELEBRATION_RANKS,
  CELEBRATION_SCOPE_LABELS,
  CELEBRATION_SCOPES,
  FACT_FIELD_LABELS,
  FACT_FIELDS,
  MASS_VARIANT_LABELS,
  MASS_VARIANTS,
  READING_ROLE_LABELS,
  READING_ROLES,
  SOURCE_JURISDICTION_LABELS,
  SOURCE_JURISDICTIONS,
  SOURCE_VERIFICATION_LABELS,
  SOURCE_VERIFICATIONS,
  SUNDAY_CYCLES,
  WEEKDAY_CYCLES,
  todayInBrazil,
  type CelebrationSource,
  type FactField,
  type LiturgicalReading,
  type ReadingRole,
} from "../../domain/calendar";
import { celebrationInputSchema, pickCelebrationInput, type CelebrationInput } from "../../domain/celebration-record";
import type { ScriptureReference } from "../../domain/scripture";
import {
  BIBLICAL_THEMES,
  LITURGICAL_CELEBRATIONS,
  LITURGICAL_COLOR_LABELS,
  LITURGICAL_COLORS,
  LITURGICAL_SEASONS,
  type LiturgicalColor,
} from "../../domain/vocabulary";
import { ChoiceGroup, ScriptureField } from "../form-fields";

type ReadingState = "registered" | "unverified" | "absent";

interface ReadingDraft {
  state: ReadingState;
  citation: string;
  ranges: ScriptureReference[];
}

interface Draft extends Omit<CelebrationInput, "readings" | "unverifiedReadings" | "notes" | "diocese"> {
  diocese: string;
  readings: Record<ReadingRole, ReadingDraft>;
  notesText: string;
}

export const EMPTY_CELEBRATION: CelebrationInput = {
  date: "",
  country: "BR",
  scope: "universal",
  celebrationKey: "",
  massVariant: "principal",
  title: "",
  rank: "domingo",
  season: "tempo-comum",
  lectionaryCycle: { sunday: "A", weekday: null },
  liturgicalColor: null,
  readings: [],
  unverifiedReadings: [],
  celebrations: [],
  biblicalThemes: [],
  notes: [],
  sources: [],
};

function toDraft(input: CelebrationInput): Draft {
  const readings = Object.fromEntries(
    READING_ROLES.map((role) => {
      const reading = input.readings.find((entry) => entry.role === role);
      const state: ReadingState = reading ? "registered" : input.unverifiedReadings.includes(role) ? "unverified" : "absent";
      return [role, { state, citation: reading?.citation ?? "", ranges: reading?.ranges ?? [] }];
    }),
  ) as Record<ReadingRole, ReadingDraft>;
  // Só o conteúdo: identificador, estado e revisão nunca entram no formulário.
  const { readings: _readings, unverifiedReadings: _unverified, notes, diocese, ...rest } = pickCelebrationInput(input);
  void _readings;
  void _unverified;
  return { ...rest, diocese: diocese ?? "", readings, notesText: notes.join("\n") };
}

function fromDraft(draft: Draft): CelebrationInput {
  const { readings, notesText, diocese, ...rest } = draft;
  const registered: LiturgicalReading[] = READING_ROLES.filter((role) => readings[role].state === "registered").map((role) => ({
    role,
    citation: readings[role].citation,
    ranges: readings[role].ranges,
  }));
  return {
    ...rest,
    ...(rest.scope === "diocesan" || diocese.trim() ? { diocese: diocese.trim() } : {}),
    readings: registered,
    unverifiedReadings: READING_ROLES.filter((role) => readings[role].state === "unverified"),
    notes: notesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

function nextSourceId(sources: readonly CelebrationSource[]): string {
  let index = sources.length + 1;
  while (sources.some((source) => source.id === `fonte-${index}`)) {
    index += 1;
  }
  return `fonte-${index}`;
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm font-medium">
      {label}
      {children}
      {hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <NativeSelect value={value} onChange={(event) => onChange(event.target.value as T)} className="w-full">
      {options.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

const list = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

const FACT_OPTIONS = FACT_FIELDS.map((id) => ({ id, label: FACT_FIELD_LABELS[id] }));

interface SourceEditorProps {
  source: CelebrationSource;
  onChange: (next: CelebrationSource) => void;
  onRemove: () => void;
}

function SourceEditor({ source, onChange, onRemove }: SourceEditorProps) {
  const set = <K extends keyof CelebrationSource>(key: K, value: CelebrationSource[K]) => onChange({ ...source, [key]: value });
  const optional = (value: string) => (value.trim() ? value : undefined);

  return (
    <fieldset className="space-y-3 rounded-xl border p-4">
      <legend className="px-1 text-sm font-medium">Fonte “{source.id}”</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Quem publica">
          <Input value={source.provider} onChange={(event) => set("provider", event.target.value)} className="h-10" />
        </Labeled>
        <Labeled label="Título do documento">
          <Input value={source.documentTitle} onChange={(event) => set("documentTitle", event.target.value)} className="h-10" />
        </Labeled>
        <Labeled label="Endereço (opcional)">
          <Input
            type="url"
            value={source.referenceUrl ?? ""}
            onChange={(event) => set("referenceUrl", optional(event.target.value))}
            className="h-10"
          />
        </Labeled>
        <Labeled label="Edição (opcional)">
          <Input value={source.edition ?? ""} onChange={(event) => set("edition", optional(event.target.value))} className="h-10" />
        </Labeled>
        <Labeled label="Consultada em">
          <Input type="date" value={source.accessedAt} onChange={(event) => set("accessedAt", event.target.value)} className="h-10" />
        </Labeled>
        <Labeled label="Origem da fonte" hint="Fonte de outro país só pode confirmar leituras, nunca o calendário do Brasil.">
          <Select
            value={source.jurisdiction}
            options={list(SOURCE_JURISDICTIONS, SOURCE_JURISDICTION_LABELS)}
            onChange={(value) => set("jurisdiction", value)}
          />
        </Labeled>
        <Labeled label="Como foi conferida">
          <Select
            value={source.verificationStatus}
            options={list(SOURCE_VERIFICATIONS, SOURCE_VERIFICATION_LABELS)}
            onChange={(value) => set("verificationStatus", value)}
          />
        </Labeled>
      </div>
      <ChoiceGroup<FactField>
        legend="O que esta fonte confirma"
        options={FACT_OPTIONS}
        selected={source.scope}
        onChange={(next) => set("scope", next)}
      />
      <Labeled label="Observação (opcional)">
        <Textarea value={source.note ?? ""} onChange={(event) => set("note", optional(event.target.value))} className="min-h-16" />
      </Labeled>
      <Button type="button" variant="outline" size="lg" className="h-10 px-3" onClick={onRemove}>
        <Trash2 data-icon="inline-start" aria-hidden />
        Remover a fonte “{source.id}”
      </Button>
    </fieldset>
  );
}

interface CelebrationEditorProps {
  initial: CelebrationInput;
  /** Rótulo do botão: criar ou salvar. */
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: (input: CelebrationInput) => void;
  /** Avisa a tela quando há alterações não salvas. */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * Conteúdo da celebração. Leituras são só referências; uma leitura sem fonte não pode ser
 * registrada: fica "não conferida". As mesmas regras valem no servidor.
 */
export function CelebrationEditor({ initial, submitLabel, pending, error, onSubmit, onDirtyChange }: CelebrationEditorProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [localError, setLocalError] = useState<string | null>(null);
  const formId = useId();
  const dirty = JSON.stringify(fromDraft(draft)) !== JSON.stringify(fromDraft(toDraft(initial)));

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setReading = (role: ReadingRole, next: Partial<ReadingDraft>) =>
    setDraft((current) => ({ ...current, readings: { ...current.readings, [role]: { ...current.readings[role], ...next } } }));

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = celebrationInputSchema.safeParse(fromDraft(draft));
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? "Confira os campos da celebração.");
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>("[role='alert']")?.focus());
      return;
    }
    setLocalError(null);
    onSubmit(parsed.data);
  }

  function addSource(): void {
    set("sources", [
      ...draft.sources,
      {
        id: nextSourceId(draft.sources),
        provider: "",
        documentTitle: "",
        accessedAt: todayInBrazil(),
        jurisdiction: "BR",
        scope: [],
        verificationStatus: "human-check",
      },
    ]);
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate aria-label="Conteúdo da celebração" className="admin-editor">
      <nav aria-label="Seções do cadastro de celebração" className="flex flex-wrap gap-2">
        {[["identificacao", "Identificação"], ["calendario", "Calendário"], ["leituras", "Leituras"], ["editorial", "Leitura editorial"], ["fontes", "Fontes"]].map(([id, label]) => (
          <a key={id} href={`#${formId}-${id}`} className="inline-flex min-h-9 items-center rounded-lg border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary hover:text-primary">{label}</a>
        ))}
      </nav>
      <section id={`${formId}-identificacao`} className="scroll-mt-28 space-y-4">
        <h2 className="font-display text-lg font-semibold">Identificação</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Data" hint="Data civil, sem horário.">
            <Input type="date" value={draft.date} onChange={(event) => set("date", event.target.value)} className="h-10" />
          </Labeled>
          <Labeled label="Formulário da missa">
            <Select value={draft.massVariant} options={list(MASS_VARIANTS, MASS_VARIANT_LABELS)} onChange={(value) => set("massVariant", value)} />
          </Labeled>
          <Labeled label="Abrangência">
            <Select value={draft.scope} options={list(CELEBRATION_SCOPES, CELEBRATION_SCOPE_LABELS)} onChange={(value) => set("scope", value)} />
          </Labeled>
          {draft.scope === "diocesan" && (
            <Labeled label="Diocese" hint="Identificador em letras minúsculas e hífens.">
              <Input value={draft.diocese} onChange={(event) => set("diocese", event.target.value)} className="h-10" />
            </Labeled>
          )}
          <Labeled label="Chave da celebração" hint="Ex.: cristo-rei. Identifica a celebração; não é o título.">
            <Input value={draft.celebrationKey} onChange={(event) => set("celebrationKey", event.target.value)} className="h-10" />
          </Labeled>
        </div>
        <Labeled label="Título">
          <Input value={draft.title} onChange={(event) => set("title", event.target.value)} className="h-10" />
        </Labeled>
      </section>

      <section id={`${formId}-calendario`} className="scroll-mt-28 space-y-4">
        <h2 className="font-display text-lg font-semibold">Calendário</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Grau">
            <Select value={draft.rank} options={list(CELEBRATION_RANKS, CELEBRATION_RANK_LABELS)} onChange={(value) => set("rank", value)} />
          </Labeled>
          <Labeled label="Tempo litúrgico">
            <Select
              value={draft.season}
              options={LITURGICAL_SEASONS.map((season) => ({ value: season.id, label: season.label }))}
              onChange={(value) => set("season", value)}
            />
          </Labeled>
          <Labeled label="Ano (ciclo dominical)">
            <Select
              value={draft.lectionaryCycle.sunday}
              options={SUNDAY_CYCLES.map((cycle) => ({ value: cycle, label: `Ano ${cycle}` }))}
              onChange={(value) => set("lectionaryCycle", { ...draft.lectionaryCycle, sunday: value })}
            />
          </Labeled>
          <Labeled label="Ciclo ferial" hint="Não se aplica a domingos e solenidades.">
            <Select
              value={draft.lectionaryCycle.weekday ?? ""}
              options={[{ value: "", label: "Não se aplica" }, ...WEEKDAY_CYCLES.map((cycle) => ({ value: cycle, label: `Ano ${cycle}` }))]}
              onChange={(value) =>
                set("lectionaryCycle", { ...draft.lectionaryCycle, weekday: value === "" ? null : (value as "I" | "II") })
              }
            />
          </Labeled>
          <Labeled label="Cor litúrgica" hint="Confirmada só se uma fonte do Brasil ou universal a confirmar.">
            <Select
              value={draft.liturgicalColor?.color ?? ""}
              options={[{ value: "", label: "Não informada" }, ...LITURGICAL_COLORS.map((color) => ({ value: color, label: LITURGICAL_COLOR_LABELS[color] }))]}
              onChange={(value) =>
                set("liturgicalColor", value === "" ? null : { ...draft.liturgicalColor, color: value as LiturgicalColor })
              }
            />
          </Labeled>
          {draft.liturgicalColor && (
            <Labeled label="Observação sobre a cor (opcional)">
              <Input
                value={draft.liturgicalColor.note ?? ""}
                onChange={(event) =>
                  set("liturgicalColor", {
                    color: (draft.liturgicalColor as { color: LiturgicalColor }).color,
                    ...(event.target.value.trim() ? { note: event.target.value } : {}),
                  })
                }
                className="h-10"
              />
            </Labeled>
          )}
        </div>
      </section>

      <section id={`${formId}-leituras`} className="scroll-mt-28 space-y-4">
        <h2 className="font-display text-lg font-semibold">Leituras</h2>
        <p className="text-sm text-muted-foreground">
          Só a referência, nunca o texto. Uma leitura só pode ser registrada se alguma fonte abaixo a confirmar; sem fonte,
          marque “Não conferida”. Salmos na numeração das Bíblias atuais.
        </p>
        {READING_ROLES.map((role) => {
          const reading = draft.readings[role];
          return (
            <fieldset key={role} className="space-y-3 rounded-xl border p-4">
              <legend className="px-1 text-sm font-medium">{READING_ROLE_LABELS[role]}</legend>
              <Labeled label={`Situação: ${READING_ROLE_LABELS[role]}`}>
                <Select
                  value={reading.state}
                  options={[
                    { value: "registered", label: "Registrada" },
                    { value: "unverified", label: "Não conferida" },
                    { value: "absent", label: "Não se aplica" },
                  ]}
                  onChange={(value) => setReading(role, { state: value })}
                />
              </Labeled>
              {reading.state === "registered" && (
                <>
                  <Labeled label={`Citação: ${READING_ROLE_LABELS[role]}`} hint="Como aparece no Lecionário. Ex.: Sl 22(23),1-2a.2b-3.5-6">
                    <Input value={reading.citation} onChange={(event) => setReading(role, { citation: event.target.value })} className="h-10" />
                  </Labeled>
                  <ScriptureField
                    legend={`Trechos: ${READING_ROLE_LABELS[role]}`}
                    references={reading.ranges}
                    max={6}
                    onChange={(ranges) => setReading(role, { ranges })}
                  />
                </>
              )}
            </fieldset>
          );
        })}
      </section>

      <section id={`${formId}-editorial`} className="scroll-mt-28 space-y-4">
        <h2 className="font-display text-lg font-semibold">Leitura editorial</h2>
        <p className="text-sm text-muted-foreground">
          Interpretação do Repertório Santa Cecília, mostrada como tal. Não vem das fontes.
        </p>
        <ChoiceGroup
          legend="Celebrações do vocabulário"
          hint="Para sugerir os cantos próprios desta celebração."
          options={LITURGICAL_CELEBRATIONS}
          selected={draft.celebrations}
          onChange={(next) => set("celebrations", next)}
          searchable
        />
        <ChoiceGroup
          legend="Temas editoriais"
          options={BIBLICAL_THEMES}
          selected={draft.biblicalThemes}
          onChange={(next) => set("biblicalThemes", next)}
          searchable
        />
        <Labeled label="Observações" hint="Uma por linha. Públicas.">
          <Textarea value={draft.notesText} onChange={(event) => set("notesText", event.target.value)} className="min-h-20" />
        </Labeled>
      </section>

      <section id={`${formId}-fontes`} className="scroll-mt-28 space-y-4">
        <h2 className="font-display text-lg font-semibold">Fontes</h2>
        <p className="text-sm text-muted-foreground">
          Toda celebração precisa de ao menos uma fonte. Indique o que cada uma confirma: o que nenhuma fonte confirma aparece
          ao público como inferência.
        </p>
        {draft.sources.map((source, index) => (
          <SourceEditor
            key={source.id}
            source={source}
            onChange={(next) => set("sources", draft.sources.map((entry, position) => (position === index ? next : entry)))}
            onRemove={() => set("sources", draft.sources.filter((_, position) => position !== index))}
          />
        ))}
        <Button type="button" variant="outline" size="lg" className="h-10 px-3" onClick={addSource}>
          <Plus data-icon="inline-start" aria-hidden />
          Adicionar fonte
        </Button>
      </section>

      <div className="form-actions">
        {(localError ?? error) && <div className="w-full"><FormError message={(localError ?? error) as string} /></div>}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvando…" : submitLabel}
        </Button>
        {dirty && <span className="text-sm text-muted-foreground">Há alterações não salvas.</span>}
      </div>
    </form>
  );
}
