"use client";

import { useState, type FormEvent } from "react";

import { FormError } from "@/components/layout/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { getLibraryErrorMessage, LibraryError } from "@/features/library/domain/library-errors";
import {
  CLASSIFICATION_REVIEW_LABELS,
  EMPTY_CLASSIFICATION_INPUT,
  classificationReviewRequestSchema,
  missingClassificationParts,
  songClassificationInputSchema,
  type ClassificationReviewRequest,
  type SongClassificationInput,
} from "@/features/liturgy/domain/classification";
import {
  BIBLICAL_THEMES,
  LITURGICAL_CELEBRATIONS,
  LITURGICAL_MOMENTS,
  LITURGICAL_SEASONS,
  SONG_USE_CATEGORIES,
  isMassCategory,
  type SongUseCategory,
} from "@/features/liturgy/domain/vocabulary";
import { ChipGroup, ChoiceGroup, ScriptureField } from "@/features/liturgy/components/form-fields";
import { showToast } from "@/lib/utils/toast";

import type { CatalogAdminApi } from "../data/catalog-admin-api";
import type { CatalogSong } from "../domain/catalog-song";

const CONFLICT_MESSAGE =
  "Esta música foi alterada por outra pessoa da administração. Recarregue a página antes de continuar.";

function toInput(song: CatalogSong): SongClassificationInput {
  if (!song.liturgy) {
    return EMPTY_CLASSIFICATION_INPUT;
  }
  const { category, moments, seasons, celebrations, themes, scripture, avoidSeasons } = song.liturgy;
  const { suitabilityNotes, editorialRationale, guidanceSource, officialReference } = song.liturgy;
  return {
    category,
    moments,
    seasons,
    celebrations,
    themes,
    scripture,
    avoidSeasons,
    suitabilityNotes,
    editorialRationale,
    guidanceSource,
    officialReference,
  };
}

interface CatalogClassificationEditorProps {
  api: CatalogAdminApi;
  song: CatalogSong;
  /** Recebe a música com a nova revisão: os dois formulários da página seguem a mesma versão. */
  onSaved: (song: CatalogSong) => void;
}

/**
 * Classificação litúrgica. É gravada por uma rota própria, com a revisão carregada: não muda
 * direitos, situação de publicação nem dados musicais.
 */
export function CatalogClassificationEditor({ api, song, onSaved }: CatalogClassificationEditorProps) {
  const [value, setValue] = useState<SongClassificationInput>(() => toInput(song));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const forMass = isMassCategory(value.category);
  const missing = missingClassificationParts(value);

  const set = <K extends keyof SongClassificationInput>(key: K, next: SongClassificationInput[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  async function run(action: () => Promise<CatalogSong>, success: string): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const saved = await action();
      onSaved(saved);
      setValue(toInput(saved));
      showToast(success);
    } catch (caught) {
      setError(
        caught instanceof LibraryError && caught.code === "revision-conflict"
          ? CONFLICT_MESSAGE
          : getLibraryErrorMessage(caught),
      );
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    // Mesmas regras do servidor, que valida tudo de novo.
    const parsed = songClassificationInputSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os campos da classificação.");
      return;
    }
    void run(() => api.classify(song, parsed.data), "Classificação salva.");
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-labelledby="classificacao-liturgica" className="surface-panel space-y-5 p-4 sm:p-6">
      <div>
        <h3 id="classificacao-liturgica" className="sr-only">
          Classificação litúrgica
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {song.liturgy
            ? `Classificada em ${new Date(song.liturgy.classifiedAt).toLocaleString("pt-BR")} pela conta ${song.liturgy.classifiedBy}.`
            : "Esta música ainda não foi classificada e não aparece nas sugestões para a missa."}{" "}
          Classificar não altera os direitos nem a situação de publicação. Use só o que a fonte fundamenta: o título,
          sozinho, não basta.
        </p>
        {missing.length > 0 && (
          <p className="mt-2 rounded-lg border border-accent/50 px-3 py-2 text-sm">
            Pode salvar assim, mas para ficar completa falta: {missing.join(", ")}.
          </p>
        )}
      </div>

      <label className="block space-y-1 text-sm font-medium">
        Tipo de uso
        <NativeSelect
          value={value.category}
          onChange={(event) => {
            const category = event.target.value as SongUseCategory;
            // Músicas que não são para a missa não ficam com momentos marcados.
            setValue((current) => ({ ...current, category, ...(isMassCategory(category) ? {} : { moments: [] }) }));
          }}
          className="w-full"
        >
          {SONG_USE_CATEGORIES.map((category) => (
            <NativeSelectOption key={category.id} value={category.id}>
              {category.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="block text-xs font-normal text-muted-foreground">
          {SONG_USE_CATEGORIES.find((category) => category.id === value.category)?.description}
        </span>
      </label>

      <ChipGroup
        legend="Momentos da missa"
        hint={forMass ? "Uma música pode servir a mais de um momento." : "Só cantos litúrgicos são indicados para momentos da missa."}
        options={LITURGICAL_MOMENTS}
        selected={value.moments}
        onChange={(next) => set("moments", next)}
        disabled={!forMass}
      />
      <ChipGroup
        legend="Tempos litúrgicos"
        hint="Marque só se a música for própria desses tempos. Sem marcação, ela pode ser sugerida em qualquer tempo."
        options={LITURGICAL_SEASONS}
        selected={value.seasons}
        onChange={(next) => set("seasons", next)}
      />
      <ChipGroup
        legend="Não sugerir nestes tempos"
        hint="Restrição. Exemplo: uma aclamação com Aleluia não é usada na Quaresma."
        options={LITURGICAL_SEASONS}
        selected={value.avoidSeasons}
        onChange={(next) => set("avoidSeasons", next)}
      />
      <ChoiceGroup
        legend="Celebrações"
        options={LITURGICAL_CELEBRATIONS}
        selected={value.celebrations}
        onChange={(next) => set("celebrations", next)}
        searchable
      />
      <ChoiceGroup
        legend="Temas"
        options={BIBLICAL_THEMES}
        selected={value.themes}
        onChange={(next) => set("themes", next)}
        searchable
      />
      <ScriptureField references={value.scripture} onChange={(next) => set("scripture", next)} />

      <label className="block space-y-1 text-sm font-medium">
        Observações de adequação (públicas)
        <Textarea
          value={value.suitabilityNotes}
          onChange={(event) => set("suitabilityNotes", event.target.value)}
          placeholder="Ex.: indicada para a procissão de entrada; evitar em celebrações penitenciais."
          className="min-h-20"
        />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        Justificativa editorial (uso interno, nunca publicada)
        <Textarea
          value={value.editorialRationale}
          onChange={(event) => set("editorialRationale", event.target.value)}
          className="min-h-20"
        />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        Fonte de orientação
        <Input
          value={value.guidanceSource}
          onChange={(event) => set("guidanceSource", event.target.value)}
          placeholder="Ex.: CNBB, “Diversos cantos para a Quaresma – Ano B”"
          className="h-10"
        />
        <span className="block text-xs font-normal text-muted-foreground">
          Subsídio, hinário ou rubrica que orientou esta classificação. Aparece ao público como referência.
        </span>
      </label>
      <label className="block space-y-1 text-sm font-medium">
        Fonte oficial (opcional)
        <Input
          value={value.officialReference}
          onChange={(event) => set("officialReference", event.target.value)}
          placeholder="Documento oficial que indica o uso deste canto"
          className="h-10"
        />
        <span className="block text-xs font-normal text-muted-foreground">
          Preencha somente com evidência específica. Com este campo, a sugestão aparece como “Indicação fundamentada em
          fonte oficial”; sem ele, como “Sugestão do Repertório Santa Cecília”.
        </span>
      </label>

      {error && <FormError message={error} />}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="h-10 px-4" disabled={pending}>
          Salvar classificação
        </Button>
        {song.liturgy && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-10 px-4"
            disabled={pending}
            onClick={() => void run(() => api.classify(song, null), "Classificação removida.")}
          >
            Remover classificação
          </Button>
        )}
      </div>
    </form>
  );
}

interface CatalogReviewPanelProps {
  api: CatalogAdminApi;
  song: CatalogSong;
  onSaved: (song: CatalogSong) => void;
}

/**
 * Revisão editorial da classificação. Conferir exige uma pessoa, a fonte consultada e a
 * classificação completa; nada é conferido automaticamente.
 */
export function CatalogReviewPanel({ api, song, onSaved }: CatalogReviewPanelProps) {
  const [action, setAction] = useState<ClassificationReviewRequest["action"] | "">("");
  const [source, setSource] = useState(song.liturgy?.guidanceSource ?? "");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const liturgy = song.liturgy;

  if (!liturgy) {
    return (
      <div className="rounded-xl border p-4 text-sm">
        <h3 className="font-medium">Revisão da classificação</h3>
        <p className="mt-1 text-muted-foreground">Classifique a música (etapa C) antes de conferir a classificação.</p>
      </div>
    );
  }

  const missing = missingClassificationParts(liturgy);
  const options: { value: ClassificationReviewRequest["action"]; label: string }[] =
    liturgy.reviewStatus === "disputed"
      ? [{ value: "resolve", label: "Resolver a divergência" }]
      : [
          ...(liturgy.reviewStatus === "pending_review" && missing.length === 0
            ? [{ value: "approve" as const, label: "Marcar como conferida" }]
            : []),
          { value: "dispute", label: "Registrar divergência" },
        ];

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!action) {
      return;
    }
    // Mesmas regras do servidor: confirmação pessoal e fonte para conferir; nota para divergência.
    const parsed = classificationReviewRequestSchema.safeParse(
      action === "approve" ? { action, humanReviewConfirmed: confirmed, source } : { action, note },
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os campos da revisão.");
      return;
    }
    const request = parsed.data;
    setError(null);
    setPending(true);
    try {
      const saved = await api.reviewClassification(song, request);
      onSaved(saved);
      showToast(CLASSIFICATION_REVIEW_LABELS[saved.liturgy?.reviewStatus ?? "pending_review"] + ".");
      setAction("");
      setNote("");
      setConfirmed(false);
    } catch (caught) {
      setError(
        caught instanceof LibraryError && caught.code === "revision-conflict" ? CONFLICT_MESSAGE : getLibraryErrorMessage(caught),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="revisao-classificacao" className="surface-panel space-y-3 p-4 text-sm sm:p-6">
      <h3 id="revisao-classificacao" className="font-medium">
        Revisão da classificação
      </h3>
      <p>
        Situação: <strong>{CLASSIFICATION_REVIEW_LABELS[liturgy.reviewStatus]}</strong>
        {liturgy.classifiedBy === "importacao-editorial" && " · classificação vinda da importação editorial"}
      </p>
      {liturgy.review && (
        <p className="text-muted-foreground">
          Conferida em {new Date(liturgy.review.at).toLocaleString("pt-BR")} pela conta {liturgy.review.by}, com base em: {liturgy.review.source}.
        </p>
      )}
      {liturgy.dispute && (
        <p className="rounded-lg border border-destructive/40 px-3 py-2 whitespace-pre-line">{liturgy.dispute.note}</p>
      )}
      {missing.length > 0 && liturgy.reviewStatus !== "disputed" && (
        <p className="text-muted-foreground">Para conferir, complete antes: {missing.join(", ")}.</p>
      )}

      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <label className="block space-y-1 font-medium">
          Ação
          <NativeSelect value={action} onChange={(event) => setAction(event.target.value as typeof action)} className="w-full">
            <NativeSelectOption value="">Escolha uma ação</NativeSelectOption>
            {options.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        {action === "approve" && (
          <>
            <label className="block space-y-1 font-medium">
              Fonte consultada na conferência
              <Input value={source} onChange={(event) => setSource(event.target.value)} className="h-10" />
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 size-4" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              Conferi pessoalmente esta classificação na fonte indicada. Isto não é aprovação oficial da Igreja.
            </label>
          </>
        )}
        {(action === "dispute" || action === "resolve") && (
          <label className="block space-y-1 font-medium">
            {action === "dispute" ? "O que diverge (uso interno)" : "Como foi resolvida (uso interno)"}
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-20" />
          </label>
        )}
        {error && <FormError message={error} />}
        {action && (
          <Button type="submit" size="lg" className="h-10 px-4" disabled={pending}>
            {options.find((option) => option.value === action)?.label}
          </Button>
        )}
      </form>
    </section>
  );
}

