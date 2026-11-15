"use client";

import { cn } from "cn";
import { ChevronLeft, ChevronRight, FileMusic, Info, Leaf, Music2, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";

import { FormError } from "@/components/layout/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLibrary } from "@/features/library/components/use-library";
import { repertoireRepository } from "@/features/library/data/browser-library";
import type { Library } from "@/features/library/domain/library";
import { getLibraryErrorMessage } from "@/features/library/domain/library-errors";
import { RepertoireBuilder } from "@/features/repertoires/components/repertoire-builder";
import type { Repertoire } from "@/features/repertoires/domain/repertoire";
import { KeyLabel } from "@/features/songs/components/key-label";
import { showToast } from "@/lib/utils/toast";

/** "22/11/2026": a data civil, sem fuso horário. */
function numericDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
import type { CatalogCoverage, MomentSuggestions, SongSuggestion } from "../domain/recommendation";
import { LITURGICAL_MOMENTS, MOMENT_KIND_LABELS, momentLabel, type LiturgicalMomentId } from "../domain/vocabulary";
import { MOMENT_ICONS } from "./liturgy-tags";

export interface PlannerCelebration {
  date: string;
  celebrationId: string;
  title: string;
  /** Revisão da celebração, guardada no repertório para avisar se ela mudar depois. */
  revision?: number;
  /** A data tem mais de uma celebração: o endereço precisa dizer qual. */
  hasVariants?: boolean;
}

interface MassPlannerProps {
  celebration: PlannerCelebration;
  /** `null`: o catálogo não respondeu. Diferente de "sem sugestões". */
  moments: MomentSuggestions[] | null;
  /** Dados não revisados, em divergência ou incompletos tornam as sugestões provisórias. */
  assurance?: "definitive" | "provisional";
  cautions?: string[];
  /** Tamanho do catálogo classificado, para explicar a ausência de sugestões. */
  catalog?: CatalogCoverage;
  activeMoment: LiturgicalMomentId | null;
  /** Repertório em construção, vindo do endereço da página. */
  repertoireId: string | null;
  /** Contexto da celebração (estado editorial e leituras), acima das sugestões. */
  intro?: ReactNode;
  /** O aviso de `intro` já traz os motivos das sugestões provisórias: não repetir aqui. */
  cautionsInIntro?: boolean;
  /** Atalhos de exploração, sob as sugestões (vêm do servidor). */
  children?: ReactNode;
}

function plannerHref(celebration: PlannerCelebration, moment: LiturgicalMomentId | null, repertoireId: string | null): string {
  const params = new URLSearchParams({ data: celebration.date });
  if (celebration.hasVariants) {
    params.set("celebracao", celebration.celebrationId);
  }
  if (moment) {
    params.set("momento", moment);
  }
  if (repertoireId) {
    params.set("repertorio", repertoireId);
  }
  return `/preparar-missa?${params}`;
}

/** Aba inicial: o momento pedido no endereço, ou o primeiro com sugestões. */
function initialMoment(moments: MomentSuggestions[] | null, active: LiturgicalMomentId | null): LiturgicalMomentId {
  if (active) {
    return active;
  }
  const withSongs = moments?.find((entry) => entry.guidance.status !== "omitted" && entry.suggestions.length > 0);
  return withSongs?.moment ?? moments?.[0]?.moment ?? LITURGICAL_MOMENTS[0].id;
}

/**
 * Sugestões por momento em abas, o repertório em construção ao lado (no computador) ou preso ao
 * rodapé (no celular). As sugestões vêm do servidor; aqui só se escolhe o que mostrar e se grava
 * o repertório na conta, sempre com a revisão carregada.
 */
export function MassPlanner({
  celebration,
  moments,
  assurance = "definitive",
  cautions = [],
  catalog,
  activeMoment,
  repertoireId,
  intro,
  cautionsInIntro = false,
  children,
}: MassPlannerProps) {
  const router = useRouter();
  const snapshot = useLibrary();
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelHint, setPanelHint] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [selected, setSelected] = useState<LiturgicalMomentId>(() => initialMoment(moments, activeMoment));
  const tabsRef = useRef<HTMLDivElement>(null);

  const library = snapshot.status === "ready" ? snapshot.library : null;
  const repertoire = library?.repertoires.find((candidate) => candidate.id === repertoireId) ?? null;
  const loaded = new Set(moments?.map((entry) => entry.moment) ?? []);

  function selectRepertoire(id: string | null): void {
    setPanelHint(null);
    router.replace(plannerHref(celebration, activeMoment, id), { scroll: false });
  }

  /** Momento já carregado: troca na hora. Os demais (na lista completa de um momento) são buscados. */
  function choose(moment: LiturgicalMomentId, focus = false): void {
    if (loaded.has(moment)) {
      setSelected(moment);
      const tab = tabsRef.current?.querySelector<HTMLElement>(`[data-moment-tab="${moment}"]`);
      // No celular a fileira rola: a aba escolhida sempre volta à vista.
      tab?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      if (focus) {
        tab?.focus();
      }
    } else {
      router.push(plannerHref(celebration, moment, repertoireId), { scroll: false });
    }
  }

  function onTabKey(event: KeyboardEvent<HTMLDivElement>): void {
    const index = LITURGICAL_MOMENTS.findIndex((moment) => moment.id === selected);
    const last = LITURGICAL_MOMENTS.length - 1;
    const target =
      event.key === "ArrowRight" ? Math.min(index + 1, last) : event.key === "ArrowLeft" ? Math.max(index - 1, 0) : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (target !== null) {
      event.preventDefault();
      choose(LITURGICAL_MOMENTS[target].id, true);
    }
  }

  async function add(suggestion: SongSuggestion, moment: LiturgicalMomentId): Promise<void> {
    if (!repertoire) {
      // Nada é guardado no navegador: sem repertório escolhido, a música não é "adicionada".
      setPanelOpen(true);
      setPanelHint(
        snapshot.status === "ready"
          ? "Crie ou escolha o repertório desta missa para adicionar músicas."
          : "Entre na sua conta para montar o repertório desta missa.",
      );
      return;
    }

    setAdding(suggestion.song.id);
    try {
      await repertoireRepository.addSong(repertoire.id, suggestion.song.id, repertoire.revision, "catalog", moment);
      showToast(`“${suggestion.song.title}” adicionada: ${momentLabel(moment)}.`);
    } catch (error) {
      showToast(getLibraryErrorMessage(error), "error");
    } finally {
      setAdding(null);
    }
  }

  const current = moments?.find((entry) => entry.moment === selected) ?? null;

  return (
    <div className="mt-2 grid grid-cols-1 gap-6 pb-24 xl:grid-cols-[minmax(0,1fr)_25rem] xl:gap-5 xl:pb-0 hd:grid-cols-[minmax(0,1fr)_27rem]">
      <div className="@container min-w-0 space-y-6">
        {intro}
        <section aria-labelledby="sugestoes-titulo">
          <h2 id="sugestoes-titulo" className="flex items-center gap-2.5 font-display text-[1.35rem] leading-tight font-semibold tracking-tight text-heading md:text-[1.6rem]">
            <Music2 className="size-6 shrink-0 text-gold md:size-7" aria-hidden />
            Sugestões por momento da Missa
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Sugestões do Repertório Web, a partir da classificação do catálogo. Não representam aprovação oficial da Igreja.
          </p>

          <div className="relative mt-3">
            {/* No celular, a fileira rola: setas e bordas esmaecidas mostram que há mais momentos. */}
            <ScrollButton direction="previous" target={tabsRef} />
            <div
              ref={tabsRef}
              role="tablist"
              aria-label="Momentos da missa"
              onKeyDown={onTabKey}
              className="-mx-4 flex snap-x scroll-px-10 gap-1 overflow-x-auto scroll-smooth px-10 pb-1 [mask-image:linear-gradient(to_right,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:[mask-image:none]"
            >
              {LITURGICAL_MOMENTS.map((moment) => {
                const Icon = MOMENT_ICONS[moment.id];
                const isSelected = moment.id === selected;
                const entry = moments?.find((candidate) => candidate.moment === moment.id);
                const omitted = entry?.guidance.status === "omitted";
                return (
                  <button
                    key={moment.id}
                    type="button"
                    role="tab"
                    id={`aba-${moment.id}`}
                    data-moment-tab={moment.id}
                    aria-selected={isSelected}
                    aria-controls={loaded.has(moment.id) ? `momento-painel-${moment.id}` : undefined}
                    title={omitted ? "Sem canto nesta celebração" : entry?.total === 0 ? "Sem sugestões no catálogo" : undefined}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => choose(moment.id)}
                    className={cn(
                      "relative flex h-10 shrink-0 snap-start items-center gap-1 rounded-lg border px-2 font-display text-[0.88rem] font-medium whitespace-nowrap transition-colors md:px-2.5",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-gold/35 bg-card text-heading hover:bg-surface-alt",
                      // Momento omitido ou sem sugestões: continua escolhível, mas visualmente secundário.
                      (omitted || entry?.total === 0) && !isSelected && "border-dashed opacity-70",
                    )}
                  >
                    <Icon className={cn("size-3.5", isSelected ? "text-primary-foreground" : "text-gold-strong")} aria-hidden />
                    {moment.label}
                    {entry && !omitted && entry.total > 0 && (
                      <span
                        aria-hidden
                        className={cn(
                          "min-w-4 rounded-full px-1 text-center font-sans text-[0.68rem] leading-4 tabular-nums",
                          isSelected ? "bg-primary-foreground/20" : "bg-surface-alt text-muted-foreground",
                        )}
                      >
                        {entry.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <ScrollButton direction="next" target={tabsRef} />
          </div>
          {activeMoment && (
            <Link
              href={plannerHref(celebration, null, repertoireId)}
              scroll={false}
              className="mt-1 inline-block text-sm font-medium underline underline-offset-3"
            >
              Ver todos os momentos
            </Link>
          )}

          {moments !== null && assurance === "provisional" && !cautionsInIntro && (
            <div role="note" className="mt-2 rounded-xl border border-gold/40 bg-card/60 px-3.5 py-2 text-[0.8rem] leading-relaxed">
              <p className="font-semibold text-heading">Sugestões provisórias</p>
              <ul className="text-muted-foreground">
                {cautions.map((caution) => (
                  <li key={caution}>{caution}</li>
                ))}
              </ul>
            </div>
          )}

          {moments === null ? (
            <p role="alert" className="mt-4 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
              Não foi possível consultar o catálogo agora. Isso não significa que não haja sugestões: tente novamente em
              instantes.
            </p>
          ) : (
            <>
              {catalog && catalog.classifiedForMass === 0 && (
                <p role="status" className="mt-3 rounded-xl border border-dashed px-4 py-4 text-sm">
                  {catalog.published === 0
                    ? "O catálogo ainda não tem músicas publicadas, por isso não há sugestões."
                    : "Nenhuma música publicada do catálogo foi classificada para a missa ainda, por isso não há sugestões."}{" "}
                  <Link href="/catalogo" className="font-medium underline underline-offset-3">
                    Buscar no catálogo
                  </Link>
                </p>
              )}
              {moments.map((entry) => (
                <MomentPanel
                  key={entry.moment}
                  hidden={entry.moment !== current?.moment}
                  entry={entry}
                  catalogEmpty={catalog?.classifiedForMass === 0}
                  celebration={celebration}
                  expanded={activeMoment !== null}
                  expandHref={plannerHref(celebration, entry.moment, repertoireId)}
                  repertoire={repertoire}
                  adding={adding}
                  onAdd={add}
                  alternatives={moments.filter(
                    (other) => other.moment !== entry.moment && other.guidance.status !== "omitted" && other.suggestions.length > 0,
                  )}
                  onChoose={(moment) => choose(moment, true)}
                />
              ))}
            </>
          )}
        </section>

        {children}
      </div>

      <RepertoireBuilder
        label="Repertório desta missa"
        title="Repertório em construção"
        subtitle={`${celebration.title} · ${numericDate(celebration.date)}`}
        emptySummary="Montar o repertório desta missa"
        status={snapshot.status}
        library={library}
        repertoire={repertoire}
        open={panelOpen}
        hint={panelHint}
        onToggle={() => setPanelOpen((open) => !open)}
        chooser={library && <ChooseRepertoire celebration={celebration} library={library} onSelect={selectRepertoire} />}
        emptyText="Ainda sem músicas. Use “Adicionar” nas sugestões; cada música é salva na hora."
        onChangeRepertoire={() => selectRepertoire(null)}
        addMore={repertoire ? { href: `/catalogo?repertorio=${encodeURIComponent(repertoire.id)}` } : undefined}
      />
    </div>
  );
}

/** Seta de rolagem da fileira de abas, só no celular. Não entra na ordem do Tab: as setas do teclado já navegam. */
function ScrollButton({ direction, target }: { direction: "previous" | "next"; target: React.RefObject<HTMLDivElement | null> }) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={direction === "previous" ? "Ver momentos anteriores" : "Ver próximos momentos"}
      onClick={() => {
        const row = target.current;
        row?.scrollBy?.({ left: (direction === "previous" ? -1 : 1) * row.clientWidth * 0.7, behavior: "smooth" });
      }}
      className={cn(
        "absolute top-0 z-10 flex size-10 items-center justify-center rounded-lg border bg-card text-heading shadow-sm md:hidden",
        direction === "previous" ? "-left-1" : "-right-1",
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

interface MomentPanelProps {
  entry: MomentSuggestions;
  hidden: boolean;
  /** O aviso geral já explicou que o catálogo não tem músicas classificadas. */
  catalogEmpty?: boolean;
  celebration: PlannerCelebration;
  expanded: boolean;
  expandHref: string;
  repertoire: Repertoire | null;
  adding: string | null;
  onAdd: (suggestion: SongSuggestion, moment: LiturgicalMomentId) => Promise<void>;
  /** Momentos que têm sugestões, oferecidos quando este não tem nenhuma. */
  alternatives?: MomentSuggestions[];
  onChoose?: (moment: LiturgicalMomentId) => void;
}

/** "à Entrada" → "a Entrada"; "ao Glória" → "o Glória": o título já traz a preposição. */
function forMoment(to: string): string {
  return to.replace(/^à /, "a ").replace(/^ao /, "o ");
}

/** Por que um momento ficou sem sugestões: falta de classificação não é o mesmo que nenhuma adequada. */
function emptyMomentMessage(entry: MomentSuggestions, catalogEmpty: boolean): string {
  if (catalogEmpty || entry.classifiedForMoment === 0) {
    return catalogEmpty
      ? "Sem sugestões para este momento."
      : "Nenhuma música do catálogo foi classificada para este momento ainda.";
  }
  if (entry.classifiedForMoment === undefined) {
    return "Nenhuma sugestão no catálogo para este momento.";
  }
  const count = entry.classifiedForMoment === 1 ? "Há 1 música classificada" : `Há ${entry.classifiedForMoment} músicas classificadas`;
  return `${count} para este momento, mas nenhuma é indicada para esta celebração (tempo litúrgico, celebração própria ou classificação em divergência).`;
}

function MomentPanel({
  entry,
  hidden,
  catalogEmpty = false,
  celebration,
  expanded,
  expandHref,
  repertoire,
  adding,
  onAdd,
  alternatives = [],
  onChoose,
}: MomentPanelProps) {
  const moment = LITURGICAL_MOMENTS.find((candidate) => candidate.id === entry.moment);
  const omitted = entry.guidance.status === "omitted";
  const label = moment?.label ?? entry.moment;

  return (
    <section
      role="tabpanel"
      id={`momento-painel-${entry.moment}`}
      aria-labelledby={`aba-${entry.moment}`}
      hidden={hidden}
      className="mt-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-gold/25 pb-2">
        <h3 id={`momento-${entry.moment}`} className="font-display text-[1.2rem] font-semibold tracking-tight text-heading md:text-[1.45rem]">
          Músicas sugeridas para {moment ? forMoment(moment.to) : label}
        </h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Info className="size-4" aria-hidden />
          Sugestões para {celebration.title}
          {moment && <span className="sr-only">. {MOMENT_KIND_LABELS[moment.kind]}</span>}
        </p>
      </div>

      {entry.guidance.note && (
        <p className="mt-2 text-sm text-muted-foreground">
          {entry.guidance.note}
          {entry.guidance.igmr && <span className="whitespace-nowrap"> (IGMR {entry.guidance.igmr})</span>}
        </p>
      )}

      {omitted ? (
        <p className="mt-3 text-sm font-medium">Não há canto para este momento nesta celebração.</p>
      ) : entry.suggestions.length === 0 ? (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-dashed bg-card/60 px-4 py-4 text-sm @xl:flex-row @xl:items-start">
          <SearchX className="size-6 shrink-0 text-gold-strong" aria-hidden />
          <div className="min-w-0 flex-1 space-y-2">
            <p>
              {emptyMomentMessage(entry, catalogEmpty)}{" "}
              <Link href={`/catalogo?momento=${entry.moment}`} className="font-medium underline underline-offset-3">
                Buscar no catálogo
              </Link>
            </p>
            {alternatives.length > 0 && onChoose && (
              <div>
                <p className="text-muted-foreground">Momentos com sugestões para esta celebração:</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {alternatives.map((other) => (
                    <li key={other.moment}>
                      <button
                        type="button"
                        onClick={() => onChoose(other.moment)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gold/40 bg-card px-3 text-[0.82rem] font-medium text-heading hover:bg-surface-alt"
                      >
                        {momentLabel(other.moment)}
                        <span className="text-xs text-muted-foreground tabular-nums">({other.total})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Uma música ocupa a largura; várias viram cartões compactos em grade.
        <ul className={cn("mt-3 grid gap-3", entry.suggestions.length > 1 && "@lg:grid-cols-2 @3xl:grid-cols-3")}>
          {entry.suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.song.id}
              layout={entry.suggestions.length === 1 ? "wide" : "compact"}
              suggestion={suggestion}
              moment={entry.moment}
              date={celebration.date}
              included={
                repertoire?.items.some((item) => item.source === "catalog" && item.songId === suggestion.song.id) ??
                false
              }
              busy={adding === suggestion.song.id}
              onAdd={onAdd}
            />
          ))}
        </ul>
      )}

      {!omitted && !expanded && entry.total > entry.suggestions.length && (
        <Link href={expandHref} scroll={false} className="mt-3 inline-block text-sm font-medium underline underline-offset-3">
          Ver as {entry.total} sugestões para {label}
        </Link>
      )}
    </section>
  );
}

interface SuggestionCardProps {
  layout: "wide" | "compact";
  suggestion: SongSuggestion;
  moment: LiturgicalMomentId;
  date: string;
  included: boolean;
  busy: boolean;
  onAdd: (suggestion: SongSuggestion, moment: LiturgicalMomentId) => Promise<void>;
}

function SuggestionCard({ layout, suggestion, moment, date, included, busy, onAdd }: SuggestionCardProps) {
  const { song, reasons } = suggestion;
  const wide = layout === "wide";

  const meta = (
    <p className="text-xs text-muted-foreground">
      {suggestion.basis === "official"
        ? `Indicação fundamentada em fonte oficial: ${suggestion.officialReference}`
        : "Sugestão do Repertório Web"}
      {" · "}
      {suggestion.classification === "reviewed" ? "classificação conferida pela equipe" : "classificação ainda não conferida"}
      {!song.hasChordPro && (song.contentType === "external-link" ? " · cifra na fonte original" : " · cifra ainda não disponível")}
    </p>
  );

  const actions = (
    <div className={cn("flex flex-wrap items-center gap-2", wide ? "@3xl:flex-col @3xl:items-stretch" : "justify-between")}>
      <Link
        href={`/catalogo/${encodeURIComponent(song.id)}?missa=${date}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-heading underline-offset-3 hover:underline"
        aria-label={`Abrir a cifra de ${song.title}`}
      >
        <FileMusic className="size-4 text-gold-strong" aria-hidden />
        {song.hasChordPro ? "Ver letra e cifra" : "Abrir música"}
      </Link>
      <Button
        type="button"
        size="sm"
        className="h-9 px-3.5"
        disabled={included || busy}
        aria-label={included ? `${song.title} já está no repertório` : `Adicionar ${song.title} ao repertório (${momentLabel(moment)})`}
        onClick={() => void onAdd(suggestion, moment)}
      >
        {!included && <Plus data-icon="inline-start" aria-hidden />}
        {included ? "No repertório" : busy ? "Adicionando…" : "Adicionar"}
      </Button>
    </div>
  );

  return (
    <li
      className={cn(
        "flex rounded-xl border bg-card shadow-[0_1px_2px_rgb(71_45_27/0.06)]",
        wide ? "flex-col gap-3 p-4 @3xl:flex-row @3xl:items-center @3xl:gap-5" : "flex-col p-3",
      )}
    >
      <div className={cn("flex items-start gap-2.5", wide && "@3xl:w-64 @3xl:shrink-0")}>
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-alt text-gold-strong">
          <Music2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[1.05rem] leading-snug font-semibold wrap-break-word text-heading">{song.title}</p>
          <p className="text-[0.8rem] text-muted-foreground wrap-break-word">
            {song.artist || "Autoria não informada"}
            {song.contentType !== "external-link" && song.originalKey && (
              <>
                {" · "}
                <span className="sr-only">Tom </span>
                <KeyLabel musicalKey={song.originalKey} />
              </>
            )}
          </p>
        </div>
      </div>

      <div className={cn("min-w-0", wide ? "space-y-1.5 @3xl:flex-1" : "mt-2 flex-1 space-y-1.5")}>
        <ul aria-label={`Por que ${song.title} foi sugerida`} className="flex flex-wrap gap-1.5">
          {reasons.map((reason) => (
            <li
              key={reason.text}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
            >
              <Leaf className="size-3 shrink-0 text-primary" aria-hidden />
              {reason.text}
            </li>
          ))}
        </ul>
        {meta}
        {suggestion.suitabilityNotes && <p className="text-xs text-muted-foreground">{suggestion.suitabilityNotes}</p>}
      </div>

      <div className={cn(!wide && "mt-auto pt-2.5")}>{actions}</div>
    </li>
  );
}

interface ChooseRepertoireProps {
  celebration: PlannerCelebration;
  library: Library;
  onSelect: (id: string) => void;
}

function ChooseRepertoire({ celebration, library, onSelect }: ChooseRepertoireProps) {
  const fieldId = useId();
  const [name, setName] = useState(`Missa — ${celebration.title}`);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Um repertório já existente nunca é substituído: a pessoa escolhe continuar nele ou criar outro.
  const existing = library.repertoires.filter((repertoire) => repertoire.mass?.date === celebration.date);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!name.trim()) {
      setError("Informe o nome do repertório.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const created = await repertoireRepository.create({
        name,
        description: "",
        mass: {
          date: celebration.date,
          celebrationId: celebration.celebrationId,
          title: celebration.title,
          ...(celebration.revision ? { celebrationRevision: celebration.revision } : {}),
        },
      });
      showToast("Repertório criado para esta celebração.");
      onSelect(created.id);
    } catch (caught) {
      setError(getLibraryErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {existing.length === 0 && (
        <p className="text-sm text-pretty text-muted-foreground">
          Crie o repertório desta missa. Cada música que você adicionar fica salva na hora, com o momento e o tom.
        </p>
      )}
      {existing.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Você já tem repertório para esta data:</p>
          <ul className="space-y-2">
            {existing.map((repertoire) => (
              <li key={repertoire.id}>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-auto min-h-10 w-full justify-start px-3 py-2 text-left whitespace-normal"
                  onClick={() => onSelect(repertoire.id)}
                >
                  Continuar em “{repertoire.name}”
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-2">
        <label htmlFor={fieldId} className="block text-sm font-medium">
          {existing.length > 0 ? "Ou crie outro repertório" : "Nome do repertório"}
        </label>
        <Input
          id={fieldId}
          value={name}
          maxLength={300}
          onChange={(event) => setName(event.target.value)}
          className="h-10 bg-background/60"
        />
        {error && <FormError message={error} />}
        <Button type="submit" size="lg" className="h-11 w-full gap-2 font-display text-base" disabled={pending}>
          <Plus className="size-4" aria-hidden />
          {pending ? "Criando…" : "Criar repertório"}
        </Button>
      </form>
    </div>
  );
}

