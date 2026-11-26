"use client";

import { Check, LoaderCircle, Music2, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { FormError } from "@/components/layout/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useLibrary } from "@/features/library/components/use-library";
import { repertoireRepository } from "@/features/library/data/browser-library";
import type { Library } from "@/features/library/domain/library";
import { getLibraryErrorMessage } from "@/features/library/domain/library-errors";
import { RepertoireBuilder } from "@/features/repertoires/components/repertoire-builder";
import type { Repertoire } from "@/features/repertoires/domain/repertoire";
import { KeyLabel } from "@/features/songs/components/key-label";
import { VideoReference } from "@/features/songs/components/video-reference";
import { showToast } from "@/lib/utils/toast";

/** "22/11/2026": a data civil, sem fuso horário. */
function numericDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
import type { CatalogCoverage, MomentSuggestions, SongSuggestion } from "../domain/recommendation";
import { LITURGICAL_MOMENTS, MOMENT_KIND_LABELS, momentLabel, type LiturgicalMomentId } from "../domain/vocabulary";

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
 * Sugestões por momento em seletor e repertório em painel sobreposto. As sugestões vêm do
 * servidor; aqui só se escolhe o que mostrar e se grava
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
  const selectionContext = `${celebration.date}:${celebration.celebrationId}:${activeMoment ?? "todos"}`;
  const [selection, setSelection] = useState(() => ({ context: selectionContext, moment: initialMoment(moments, activeMoment) }));
  // O Next preserva o componente durante a navegação: uma nova resposta deve refletir seu momento.
  // A seleção local só vale para o contexto em que foi feita; os rascunhos do painel permanecem.
  const selected = selection.context === selectionContext ? selection.moment : initialMoment(moments, activeMoment);

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
      setSelection({ context: selectionContext, moment });
      if (focus) document.getElementById("mass-moment")?.focus();
    } else {
      router.push(plannerHref(celebration, moment, repertoireId), { scroll: false });
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
    <div className="workspace-content">
      <div className="workspace-body @container min-w-0 space-y-4" tabIndex={0} role="region" aria-label="Sugestões da celebração">
        {intro}
        <section aria-labelledby="sugestoes-titulo">
          <h2 id="sugestoes-titulo" className="sr-only">
            <Music2 className="size-6 shrink-0 text-gold md:size-7" aria-hidden />
            Sugestões por momento da Missa
          </h2>


          <div className="mt-5 max-w-lg space-y-2">
            <label htmlFor="mass-moment" className="block text-sm font-semibold">Momento da missa</label>
            <NativeSelect id="mass-moment" value={selected} onChange={event => choose(event.target.value as LiturgicalMomentId)}>
              {LITURGICAL_MOMENTS.map(moment => <option key={moment.id} value={moment.id}>{moment.label}</option>)}
            </NativeSelect>
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
        <p className="text-sm text-muted-foreground">Sugestões editoriais, a partir da classificação do catálogo. Não representam aprovação oficial da Igreja.</p>
      </div>

      <RepertoireBuilder
        className="repertoire-dock-inline"
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
      role="region"
      id={`momento-painel-${entry.moment}`}
      aria-label={`Sugestões para ${label}`}
      hidden={hidden}
      className="mt-4"
    >
      <h3 id={`momento-${entry.moment}`} className="sr-only">Músicas sugeridas para {moment ? forMoment(moment.to) : label}</h3>
      {moment && <p className="sr-only">{MOMENT_KIND_LABELS[moment.kind]}</p>}

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
        <ul className={"mt-3 divide-y overflow-hidden rounded-2xl border bg-card"}>
          {entry.suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.song.id}
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
  suggestion: SongSuggestion;
  moment: LiturgicalMomentId;
  date: string;
  included: boolean;
  busy: boolean;
  onAdd: (suggestion: SongSuggestion, moment: LiturgicalMomentId) => Promise<void>;
}

function SuggestionCard({ suggestion, moment, date, included, busy, onAdd }: SuggestionCardProps) {
  const { song } = suggestion;
  return (
    <li className="flex items-center gap-3 px-3 py-4 sm:px-5">
      <Link href={`/catalogo/${encodeURIComponent(song.id)}?missa=${date}`} className="flex min-h-12 min-w-0 flex-1 flex-col justify-center">
        <span className="font-semibold text-heading wrap-break-word">{song.title}</span>
        <span className="mt-1 text-sm text-muted-foreground">{song.artist || "Autoria não informada"}</span>
      </Link>
      {song.contentType !== "external-link" && song.originalKey && <span className="hidden text-sm text-chord sm:block"><KeyLabel musicalKey={song.originalKey} /></span>}
      {song.video && <VideoReference variant="play" videoId={song.video.videoId} videoTitle={song.video.title} startSeconds={song.video.startSeconds} title={song.title} />}
      <Button type="button" variant={included ? "secondary" : "outline"} size="icon" disabled={included || busy}
        aria-label={included ? `${song.title} já está no repertório` : `Adicionar ${song.title} ao repertório (${momentLabel(moment)})`}
        onClick={() => void onAdd(suggestion, moment)}>
        {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : included ? <Check aria-hidden /> : <Plus aria-hidden />}
      </Button>
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

