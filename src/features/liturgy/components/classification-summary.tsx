import type { PublicSongClassification } from "../domain/classification";
import { formatScriptureReference } from "../domain/scripture";
import {
  SONG_USE_CATEGORIES,
  celebrationLabel,
  isMassCategory,
  momentLabel,
  seasonLabel,
  themeLabel,
} from "../domain/vocabulary";

function Row({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 py-1.5">
      <dt className="w-32 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 wrap-break-word">{values.join(" · ")}</dd>
    </div>
  );
}

function reviewNote(liturgy: PublicSongClassification): string {
  if (liturgy.reviewStatus === "reviewed" && liturgy.review) {
    const date = new Date(liturgy.review.at).toLocaleDateString("pt-BR", { timeZone: "UTC" });
    return `Conferida por uma pessoa da equipe em ${date} (fonte: ${liturgy.review.source}).`;
  }
  if (liturgy.reviewStatus === "disputed") {
    return "Classificação com divergência em análise.";
  }
  return "Classificação ainda não conferida por uma pessoa da equipe.";
}

/** Classificação litúrgica pública de uma música. É orientação editorial, não aprovação oficial. */
export function ClassificationSummary({ liturgy }: { liturgy: PublicSongClassification }) {
  const category = SONG_USE_CATEGORIES.find((entry) => entry.id === liturgy.category);

  return (
    <section aria-labelledby="uso-liturgico" className="rounded-xl border bg-card p-4 text-sm">
      <h2 id="uso-liturgico" className="font-display text-base font-semibold">
        Uso litúrgico
      </h2>
      <p className="mt-1">
        <span className="font-medium">{category?.label ?? liturgy.category}.</span>{" "}
        <span className="text-muted-foreground">{category?.description}</span>
      </p>
      {!isMassCategory(liturgy.category) && (
        <p className="mt-1 text-muted-foreground">Esta música não aparece nas sugestões para a missa.</p>
      )}
      <dl className="mt-2 divide-y">
        <Row label="Momentos" values={liturgy.moments.map(momentLabel)} />
        <Row label="Tempos" values={liturgy.seasons.map(seasonLabel)} />
        <Row label="Celebrações" values={liturgy.celebrations.map(celebrationLabel)} />
        <Row label="Temas" values={liturgy.themes.map(themeLabel)} />
        <Row label="Referências bíblicas" values={liturgy.scripture.map(formatScriptureReference)} />
        <Row label="Não usar em" values={liturgy.avoidSeasons.map(seasonLabel)} />
      </dl>
      {liturgy.suitabilityNotes && <p className="mt-2 text-pretty">{liturgy.suitabilityNotes}</p>}
      {liturgy.officialReference && (
        <p className="mt-2 text-pretty">
          <span className="font-medium">Indicação fundamentada em fonte oficial:</span> {liturgy.officialReference}
        </p>
      )}
      {liturgy.guidanceSource && (
        <p className="mt-2 text-pretty">
          <span className="font-medium">Fonte de orientação:</span> {liturgy.guidanceSource}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {reviewNote(liturgy)} Classificação editorial do Repertório Santa Cecília. Não representa aprovação oficial da Igreja.
      </p>
    </section>
  );
}
