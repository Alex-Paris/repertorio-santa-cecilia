"use client";

import { cn } from "cn";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { FormError } from "@/components/layout/form-error";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { getLibraryErrorMessage, LibraryError } from "@/features/library/domain/library-errors";
import { showToast } from "@/lib/utils/toast";

import {
  createLiturgyAdminApi,
  type CelebrationDiagnostics,
  type CelebrationHistoryItem,
  type LiturgyAdminApi,
} from "../../data/liturgy-admin-api";
import {
  FACT_FIELD_LABELS,
  FACT_FIELDS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUSES,
  celebrationDisplayTitle,
  formatLongDate,
  type CelebrationPage,
  type FactField,
  type ReviewStatus,
} from "../../domain/calendar";
import {
  CELEBRATION_FIELD_LABELS,
  computeProvenance,
  type CelebrationInput,
  type CelebrationRecord,
} from "../../domain/celebration-record";
import { allowedReviewActions, REVIEW_ACTION_LABELS, type ReviewAction, type ReviewRequest } from "../../domain/review";
import { DISCARD_RULE_LABELS, type DiscardRule } from "../../domain/recommendation";
import { LITURGICAL_SEASONS, momentLabel, seasonLabel } from "../../domain/vocabulary";
import { ReviewStatusBadge } from "../celebration-picker";
import { ChoiceGroup } from "../form-fields";
import { CelebrationEditor, EMPTY_CELEBRATION } from "./celebration-editor";
import { CelebrationPrefill } from "./celebration-prefill";

const CONFLICT_MESSAGE =
  "Esta celebração foi alterada por outra pessoa da administração. Recarregue a página antes de continuar.";

function messageOf(error: unknown): string {
  return error instanceof LibraryError && error.code === "revision-conflict" ? CONFLICT_MESSAGE : getLibraryErrorMessage(error);
}

const PAGE_SIZE = 20;

/** Lista da administração: busca por data e título, filtros por situação e tempo, paginada. */
export function LiturgyAdminList({ userId }: { userId: string }) {
  const api = useMemo(() => createLiturgyAdminApi(userId), [userId]);
  const [filters, setFilters] = useState({ q: "", from: "", to: "", status: "" as ReviewStatus | "", season: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CelebrationPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.list({ ...applied, page, pageSize: PAGE_SIZE } as never).then(
      (next) => {
        if (active) {
          setResult(next);
          setError(null);
        }
      },
      (caught: unknown) => active && setError(messageOf(caught)),
    );
    return () => {
      active = false;
    };
  }, [api, applied, page]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPage(1);
    setApplied(filters);
  }

  const set = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/catalogo/qualidade" className="text-sm font-medium underline underline-offset-3">
          Qualidade da classificação do catálogo
        </Link>
        <Link href="/admin/liturgia/nova" className={cn(buttonVariants({ size: "lg" }))}>
          <Plus data-icon="inline-start" aria-hidden />
          Nova celebração
        </Link>
      </div>

      <form onSubmit={submit} role="search" aria-label="Filtrar celebrações" className="surface-panel grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <label className="space-y-1 text-sm font-medium sm:col-span-2">
          Título
          <Input value={filters.q} onChange={(event) => set("q", event.target.value)} className="h-10" />
        </label>
        <label className="space-y-1 text-sm font-medium">
          A partir de
          <Input type="date" value={filters.from} onChange={(event) => set("from", event.target.value)} className="h-10" />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Até
          <Input type="date" value={filters.to} onChange={(event) => set("to", event.target.value)} className="h-10" />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Situação
          <NativeSelect value={filters.status} onChange={(event) => set("status", event.target.value)} className="w-full">
            <NativeSelectOption value="">Todas</NativeSelectOption>
            {REVIEW_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {REVIEW_STATUS_LABELS[status]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm font-medium">
          Tempo litúrgico
          <NativeSelect value={filters.season} onChange={(event) => set("season", event.target.value)} className="w-full">
            <NativeSelectOption value="">Todos</NativeSelectOption>
            {LITURGICAL_SEASONS.map((season) => (
              <NativeSelectOption key={season.id} value={season.id}>
                {season.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" size="lg" className="h-10 px-4">
            Filtrar
          </Button>
        </div>
      </form>

      {error && <FormError message={error} />}
      {!result && !error && <ContentSkeleton />}
      {result && (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {result.total === 1 ? "1 celebração" : `${result.total} celebrações`}
          </p>
          {result.celebrations.length > 0 && (
            <ul className="surface-panel divide-y">
              {result.celebrations.map((entry) => (
                <li key={entry.celebrationId}>
                  <Link href={`/admin/liturgia/${entry.celebrationId}`} className="flex min-h-20 flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4 transition-colors hover:bg-muted/60">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium wrap-break-word">{celebrationDisplayTitle(entry)}</span>
                      <span className="block text-sm text-muted-foreground">
                        {entry.date} · {seasonLabel(entry.season)} · revisão {entry.revision}
                      </span>
                    </span>
                    <ReviewStatusBadge status={entry.reviewStatus} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {result.totalPages > 1 && (
            <nav aria-label="Páginas" className="flex items-center justify-between gap-2 text-sm">
              <Button variant="outline" size="lg" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <span className="tabular-nums text-muted-foreground">
                Página {result.page} de {result.totalPages}
              </span>
              <Button variant="outline" size="lg" disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}>
                Próxima
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

/** Criação: a celebração nasce em revisão, nunca revisada. */
export function CelebrationCreateScreen({ userId }: { userId: string }) {
  const router = useRouter();
  const api = useMemo(() => createLiturgyAdminApi(userId), [userId]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState({ version: 0, initial: EMPTY_CELEBRATION });
  const [dirty, setDirty] = useState(false);

  async function create(input: CelebrationInput): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const created = await api.create(input);
      showToast("Celebração criada. Ela aguarda revisão.");
      router.replace(`/admin/liturgia/${created.id}`);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <CelebrationPrefill pending={pending} dirty={dirty} loadByDate={api.prefill} onApply={(initial) => {
        setEditor((current) => ({ version: current.version + 1, initial }));
        setDirty(false);
        setError(null);
      }} />
      <CelebrationEditor
        key={editor.version}
        initial={editor.initial}
        submitLabel="Criar celebração"
        pending={pending}
        error={error}
        onSubmit={(input) => void create(input)}
        onDirtyChange={setDirty}
      />
    </div>
  );
}

const HISTORY_LABELS: Record<string, string> = {
  import: "Importação editorial",
  create: "Criada",
  update: "Editada",
  approve: "Aprovada",
  dispute: "Divergência registrada",
  resolve: "Divergência resolvida",
  reopen: "Revisão reaberta",
};

function fieldLabel(field: string): string {
  return (CELEBRATION_FIELD_LABELS as Record<string, string>)[field] ?? (FACT_FIELD_LABELS as Record<string, string>)[field] ?? field;
}

function History({ entries }: { entries: CelebrationHistoryItem[] | null }) {
  if (!entries) {
    return <ContentSkeleton />;
  }
  return (
    <ol className="space-y-3 text-sm">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-lg border px-3 py-2">
          <p className="font-medium">
            {HISTORY_LABELS[entry.action] ?? entry.action} · revisão {entry.fromRevision ?? "—"} → {entry.toRevision}
          </p>
          <p className="text-muted-foreground">
            {new Date(entry.at).toLocaleString("pt-BR")} · {entry.actor} ·{" "}
            {entry.fromStatus ? `${REVIEW_STATUS_LABELS[entry.fromStatus]} → ` : ""}
            {REVIEW_STATUS_LABELS[entry.toStatus]}
          </p>
          {entry.changedFields.length > 0 && (
            <p className="text-muted-foreground">Campos: {entry.changedFields.map(fieldLabel).join(", ")}</p>
          )}
          {entry.approvedRevision !== undefined && (
            <p className="text-muted-foreground">
              Aprovou a revisão {entry.approvedRevision}, com base em: {(entry.sourceIds ?? []).join(", ")}
            </p>
          )}
          {entry.note && <p className="mt-1 whitespace-pre-line">{entry.note}</p>}
        </li>
      ))}
    </ol>
  );
}

interface ReviewPanelProps {
  record: CelebrationRecord;
  blocked: boolean;
  onReview: (request: ReviewRequest) => Promise<void>;
}

/** Ações de revisão. A aprovação exige a confirmação de conferência humana e as fontes usadas. */
function ReviewPanel({ record, blocked, onReview }: ReviewPanelProps) {
  const actions = allowedReviewActions(record.reviewStatus);
  const [action, setAction] = useState<ReviewAction | "">("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [fields, setFields] = useState<FactField[]>([]);
  const [pending, setPending] = useState(false);
  const provenance = computeProvenance(record);
  const inferred = provenance.filter((entry) => entry.status === "inference");
  const missing = provenance.filter((entry) => entry.status === "missing");

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!action) {
      return;
    }
    const trimmed = note.trim();
    const request: ReviewRequest =
      action === "approve"
        ? { action, humanReviewConfirmed: confirmed as true, sourceIds, ...(trimmed ? { note: trimmed } : {}) }
        : action === "dispute"
          ? { action, fields, note: trimmed }
          : { action, note: trimmed };
    setPending(true);
    try {
      await onReview(request);
      setAction("");
      setNote("");
      setConfirmed(false);
      setSourceIds([]);
      setFields([]);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="revisao-titulo" className="surface-panel max-w-4xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="revisao-titulo" className="font-display text-lg font-semibold">
          Revisão editorial
        </h2>
        <ReviewStatusBadge status={record.reviewStatus} />
      </div>
      <p className="text-sm text-muted-foreground">Revisão do documento: {record.revision}.</p>

      {record.approval && (
        <p className="text-sm">
          Aprovada em {new Date(record.approval.at).toLocaleString("pt-BR")} pela conta {record.approval.by}, sobre a revisão{" "}
          {record.approval.revision}, com base em: {record.approval.sourceIds.join(", ")}.
        </p>
      )}
      {record.dispute && (
        <div className="rounded-lg border border-destructive/40 px-3 py-2 text-sm">
          <p className="font-medium">Divergência em: {record.dispute.fields.map((field) => FACT_FIELD_LABELS[field]).join(", ")}</p>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">{record.dispute.note}</p>
        </div>
      )}
      {(inferred.length > 0 || missing.length > 0) && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
          {inferred.length > 0 && (
            <li>Sem fonte que confirme: {inferred.map((entry) => FACT_FIELD_LABELS[entry.field].toLowerCase()).join(", ")}.</li>
          )}
          {missing.length > 0 && (
            <li>Não conferido: {missing.map((entry) => FACT_FIELD_LABELS[entry.field].toLowerCase()).join(", ")}.</li>
          )}
        </ul>
      )}

      {blocked ? (
        <p className="text-sm font-medium">Salve ou desfaça as alterações do conteúdo antes de revisar.</p>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-3">
          <label className="block space-y-1 text-sm font-medium">
            Ação
            <NativeSelect value={action} onChange={(event) => setAction(event.target.value as ReviewAction | "")} className="w-full">
              <NativeSelectOption value="">Escolha uma ação</NativeSelectOption>
              {actions.map((entry) => (
                <NativeSelectOption key={entry} value={entry}>
                  {REVIEW_ACTION_LABELS[entry]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>

          {action === "approve" && (
            <>
              <ChoiceGroup
                legend="Fontes que fundamentam a aprovação"
                options={record.sources.map((source) => ({ id: source.id, label: `${source.id}: ${source.provider}` }))}
                selected={sourceIds}
                onChange={setSourceIds}
              />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                Conferi pessoalmente esta celebração nas fontes indicadas. Uma comparação automatizada não basta.
              </label>
            </>
          )}
          {action === "dispute" && (
            <ChoiceGroup<FactField>
              legend="Dados em divergência"
              options={FACT_FIELDS.map((id) => ({ id, label: FACT_FIELD_LABELS[id] }))}
              selected={fields}
              onChange={setFields}
            />
          )}
          {action && (
            <label className="block space-y-1 text-sm font-medium">
              {action === "approve" ? "Observação (opcional)" : "Observação"}
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-20" />
            </label>
          )}
          {action && (
            <Button type="submit" size="lg" className="h-10 px-4" disabled={pending}>
              {pending ? "Enviando…" : REVIEW_ACTION_LABELS[action]}
            </Button>
          )}
        </form>
      )}
    </section>
  );
}

/** Edição, revisão e histórico de uma celebração. */
/** Mesmas regras das sugestões públicas, em números: ajuda a decidir o que classificar. */
function SuggestionDiagnostics({ api, celebrationId }: { api: LiturgyAdminApi; celebrationId: string }) {
  const [data, setData] = useState<CelebrationDiagnostics | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    api.diagnostics(celebrationId).then(
      (loaded) => active && setData(loaded),
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, [api, celebrationId]);

  return (
    <section aria-labelledby="diagnostico-titulo" className="surface-panel max-w-4xl space-y-3 p-4 sm:p-6">
      <h2 id="diagnostico-titulo" className="font-display text-lg font-semibold">
        Sugestões do catálogo
      </h2>
      {failed ? (
        <p className="text-sm">Não foi possível calcular agora.</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Calculando…</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Músicas publicadas e classificadas para cada momento, quantas passam pelas regras desta celebração e por
            que as demais ficam de fora.{data.truncated && " O catálogo classificado excede o limite de análise: os números são parciais."}
          </p>
          <div tabIndex={0} role="region" aria-label="Diagnóstico das sugestões" className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Momento</th>
                  <th scope="col" className="px-3 py-2 font-medium">Classificadas</th>
                  <th scope="col" className="px-3 py-2 font-medium">Elegíveis</th>
                  <th scope="col" className="px-3 py-2 font-medium">Conferidas</th>
                  <th scope="col" className="px-3 py-2 font-medium">Com cifra</th>
                  <th scope="col" className="px-3 py-2 font-medium">Descartadas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.moments.map((entry) => (
                  <tr key={entry.moment}>
                    <th scope="row" className="px-3 py-2 text-left font-medium">{momentLabel(entry.moment)}</th>
                    <td className="px-3 py-2 tabular-nums">{entry.classified}</td>
                    <td className="px-3 py-2 tabular-nums">{entry.eligible}</td>
                    <td className="px-3 py-2 tabular-nums">{entry.reviewed}</td>
                    <td className="px-3 py-2 tabular-nums">{entry.withChordPro}</td>
                    <td className="px-3 py-2 text-xs">
                      {Object.entries(entry.discarded)
                        .map(([rule, count]) => `${DISCARD_RULE_LABELS[rule as DiscardRule]}: ${count}`)
                        .join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export function CelebrationAdminScreen({ userId, celebrationId }: { userId: string; celebrationId: string }) {
  const api = useMemo(() => createLiturgyAdminApi(userId), [userId]);
  const [record, setRecord] = useState<CelebrationRecord | null>(null);
  const [history, setHistory] = useState<CelebrationHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadHistory = useCallback(() => {
    void api.history(celebrationId).then(setHistory, () => setHistory([]));
  }, [api, celebrationId]);

  useEffect(() => {
    let active = true;
    api.get(celebrationId).then(
      (loaded) => active && setRecord(loaded),
      (caught: unknown) => active && setError(messageOf(caught)),
    );
    loadHistory();
    return () => {
      active = false;
    };
  }, [api, celebrationId, loadHistory]);

  if (!record) {
    return error ? <FormError message={error} /> : <ContentSkeleton />;
  }

  async function save(input: CelebrationInput): Promise<void> {
    const current = record as CelebrationRecord;
    setPending(true);
    setSaveError(null);
    try {
      const saved = await api.update(current, input);
      setRecord(saved);
      showToast(
        saved.revision === current.revision
          ? "Nada mudou."
          : current.reviewStatus === "reviewed"
            ? "Alterações salvas. A celebração voltou para revisão."
            : "Alterações salvas.",
      );
      loadHistory();
    } catch (caught) {
      setSaveError(messageOf(caught));
    } finally {
      setPending(false);
    }
  }

  async function review(request: ReviewRequest): Promise<void> {
    try {
      const saved = await api.review(record as CelebrationRecord, request);
      setRecord(saved);
      showToast(`Situação: ${REVIEW_STATUS_LABELS[saved.reviewStatus]}.`);
      loadHistory();
    } catch (caught) {
      showToast(messageOf(caught), "error");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{formatLongDate(record.date)}</p>
        <p className="font-display text-xl font-semibold">{celebrationDisplayTitle(record)}</p>
        <Link
          href={`/preparar-missa?data=${record.date}&celebracao=${encodeURIComponent(record.id)}`}
          className="text-sm font-medium underline underline-offset-3"
        >
          Ver como o público vê
        </Link>
      </div>
      <ReviewPanel key={record.revision} record={record} blocked={dirty} onReview={review} />
      <CelebrationEditor
        key={`editor-${record.revision}`}
        initial={record}
        submitLabel="Salvar alterações"
        pending={pending}
        error={saveError}
        onSubmit={(input) => void save(input)}
        onDirtyChange={setDirty}
      />
      <SuggestionDiagnostics key={`diagnostico-${record.revision}`} api={api} celebrationId={record.id} />
      <section aria-labelledby="historico-titulo" className="surface-panel max-w-4xl space-y-3 p-4 sm:p-6">
        <h2 id="historico-titulo" className="font-display text-lg font-semibold">
          Histórico de alterações
        </h2>
        <History entries={history} />
      </section>
    </div>
  );
}
