"use client";

import { cn } from "cn";
import { ChevronRight, Inbox } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { FormError } from "@/components/layout/form-error";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { CatalogSong } from "@/features/catalog/domain/catalog-song";
import { getLibraryErrorMessage, LibraryError } from "@/features/library/domain/library-errors";
import { celebrationLabel, momentLabel, seasonLabel, themeLabel } from "@/features/liturgy/domain/vocabulary";
import { ChordSheet } from "@/features/songs/components/chord-sheet";
import { KeyLabel } from "@/features/songs/components/key-label";
import { VideoReference } from "@/features/songs/components/video-reference";
import { MUSICAL_KEYS, type MusicalKey } from "@/features/songs/domain/musical-key";
import { createRequestId } from "@/lib/utils/request-id";
import { showToast } from "@/lib/utils/toast";

import { createSubmissionAdminApi, type SubmissionAdminApi } from "../data/submission-api";
import {
  canLicenseContent,
  hasSuggestedClassification,
  RIGHTS_STATUS_LABELS,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUSES,
  SUBMISSION_TEXT_MAX,
  type AdminSubmission,
  type AdminSubmissionSummary,
  type SubmissionStatus,
} from "../domain/submission";
import { formatDateTime, SubmissionStatusBadge, SubmissionTimeline } from "./submission-ui";

const CONFLICT_MESSAGE = "Esta sugestão mudou (outra pessoa da equipe decidiu ou o colaborador agiu). A versão atual foi carregada.";

// -------------------------------------------------------------------------------------------
// Fila

/** Fila da administração, filtrada por situação; em análise primeiro, em ordem de chegada. */
export function SubmissionQueue({ userId }: { userId: string }) {
  const api = useMemo(() => createSubmissionAdminApi(userId), [userId]);
  const [status, setStatus] = useState<SubmissionStatus | "">("pending");
  const [result, setResult] = useState<{ key: string; list: AdminSubmissionSummary[] } | { key: string; error: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.list(status || undefined, controller.signal).then(
      (list) => setResult({ key: status, list }),
      (error: unknown) => {
        if (!controller.signal.aborted) setResult({ key: status, error: getLibraryErrorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [api, status]);

  const current = result?.key === status ? result : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <label htmlFor="contribuicoes-situacao" className="block text-sm font-medium">
            Situação
          </label>
          <NativeSelect
            id="contribuicoes-situacao"
            value={status}
            onChange={(event) => setStatus(event.target.value as SubmissionStatus | "")}
          >
            {SUBMISSION_STATUSES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {SUBMISSION_STATUS_LABELS[value]}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value="">Todas</NativeSelectOption>
          </NativeSelect>
        </div>
        <Link href="/admin/catalogo" className="text-sm font-medium underline underline-offset-3">
          Administrar catálogo
        </Link>
      </div>
      {!current && <ContentSkeleton />}
      {current && "error" in current && <FormError message={current.error} />}
      {current && "list" in current && current.list.length === 0 && (
        <EmptyState icon={Inbox} title="Nenhuma sugestão nesta situação" description="As novas sugestões aparecem aqui assim que são enviadas." />
      )}
      {current && "list" in current && current.list.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card">
          {current.list.map((entry) => (
            <li key={entry.id}>
              <Link
                href={`/admin/contribuicoes/${encodeURIComponent(entry.id)}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium wrap-break-word">{entry.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {entry.artist || "Autoria não informada"} · {entry.submitterName ?? "conta removida"} ·{" "}
                    {formatDateTime(entry.submittedAt)}
                    {entry.version > 1 ? ` · versão ${entry.version}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.hasContent ? "Com letra e cifra" : "Sem cifra"} · {entry.hasVideo ? "com vídeo" : "sem vídeo"} ·{" "}
                    {RIGHTS_STATUS_LABELS[entry.rightsStatus]}
                  </p>
                </div>
                <SubmissionStatusBadge status={entry.status} />
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------------------------
// Revisão

function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3 rounded-xl border bg-card p-4 md:p-5", className)}>
      <h2 className="font-display text-lg font-semibold text-heading">{title}</h2>
      {children}
    </section>
  );
}

function Check({ checked, onChange, children, disabled }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={cn("flex items-start gap-2 text-sm", disabled && "opacity-60")}>
      <input type="checkbox" className="mt-1" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

type DetailState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; submission: AdminSubmission };

/** Revisão de uma sugestão: dados, direitos, duplicatas e as decisões possíveis. */
export function SubmissionReview({ userId, submissionId }: { userId: string; submissionId: string }) {
  const api = useMemo(() => createSubmissionAdminApi(userId), [userId]);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.get(submissionId, controller.signal).then(
      (submission) => setState({ status: "ready", submission }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ status: "error", message: getLibraryErrorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [api, submissionId, reload]);

  if (state.status === "loading") return <ContentSkeleton />;
  if (state.status === "error") return <FormError message={state.message} />;

  const { submission } = state;
  const { snapshot, suggestedClassification: suggested } = submission;
  const decidable = submission.status === "pending" || submission.status === "needs_changes";
  const ownSubmission = submission.submittedBy?.id === userId;

  /** Depois de uma recusa por conflito, recarrega e explica; outros erros sobem ao formulário. */
  function handleFailure(error: unknown): never {
    if (
      error instanceof LibraryError &&
      (error.code === "revision-conflict" || error.code === "submission-already-reviewed")
    ) {
      setNotice(CONFLICT_MESSAGE);
      setReload((value) => value + 1);
    }
    throw error;
  }

  function updated(next: AdminSubmission, message: string): void {
    setNotice(null);
    setState({ status: "ready", submission: next });
    showToast(message);
  }

  return (
    <div className="space-y-4">
      <div className="min-w-0 space-y-4">
        {notice && <p role="status" className="rounded-lg border border-gold/60 bg-gold/10 px-3 py-2 text-sm">{notice}</p>}
        <Panel title="Sugestão">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold wrap-break-word text-heading">{snapshot.title}</p>
              <p className="text-sm text-muted-foreground">
                {snapshot.artist || "Autoria não informada"} · tom <KeyLabel musicalKey={snapshot.originalKey} /> · versão{" "}
                {submission.version}
              </p>
            </div>
            <SubmissionStatusBadge status={submission.status} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Enviada por</dt>
            <dd className="min-w-0 wrap-break-word">
              {submission.submittedBy ? `${submission.submittedBy.name} (${submission.submittedBy.email})` : "Conta não encontrada"}
              <span className="block text-xs text-muted-foreground">Dado interno da equipe; nunca aparece no catálogo.</span>
            </dd>
            <dt className="text-muted-foreground">Enviada em</dt>
            <dd>{formatDateTime(submission.submittedAt)}</dd>
            <dt className="text-muted-foreground">Crédito</dt>
            <dd className="min-w-0 wrap-break-word">
              {submission.credit.show ? `Pediu crédito como “${submission.credit.name}”` : "Não quer crédito público"}
            </dd>
            {submission.message && (
              <>
                <dt className="text-muted-foreground">Mensagem</dt>
                <dd className="min-w-0 whitespace-pre-line wrap-break-word">{submission.message}</dd>
              </>
            )}
          </dl>
          {snapshot.chordPro ? (
            <details className="rounded-lg border bg-background/60" open>
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Letra e cifra enviadas</summary>
              <div className="max-h-[28rem] overflow-auto border-t px-3 py-3">
                <ChordSheet source={snapshot.chordPro} fontSize={15} />
              </div>
            </details>
          ) : (
            <p className="text-sm text-muted-foreground">
              {snapshot.contentType === "external-link"
                ? "A música particular é um link externo; o link não é publicado a partir de sugestões."
                : submission.status === "withdrawn"
                  ? "A cifra foi descartada quando o colaborador retirou a sugestão."
                  : "Sem cifra."}
            </p>
          )}
        </Panel>

        <Panel title="Direitos declarados">
          <p className="text-sm font-medium">{RIGHTS_STATUS_LABELS[submission.rights.status]}</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            <li>Exibir no catálogo: {submission.rights.license.display ? "autorizado" : "não autorizado"}</li>
            <li>Reproduzir: {submission.rights.license.reproduce ? "autorizado" : "não autorizado"}</li>
            <li>Redistribuir em links públicos: {submission.rights.license.redistribute ? "autorizado" : "não autorizado"}</li>
          </ul>
          {submission.rights.note && <p className="text-sm whitespace-pre-line">{submission.rights.note}</p>}
          <p className="text-xs text-muted-foreground">
            Declaração versão {submission.rights.declarationVersion}, aceita em {formatDateTime(submission.rights.acceptedAt)}. É
            declaração, não prova: na dúvida, aprove só os metadados.
          </p>
        </Panel>

        <Panel title="Possíveis duplicatas">
          {submission.duplicateJustification && (
            <p className="rounded-lg border bg-background/60 px-3 py-2 text-sm whitespace-pre-line">
              <span className="font-medium">Justificativa do colaborador: </span>
              {submission.duplicateJustification}
            </p>
          )}
          {submission.duplicates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma música do catálogo com o mesmo título.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {submission.duplicates.map((match) => (
                <li key={match.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 wrap-break-word">
                    <span className="font-medium">{match.title}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {match.artist || "autoria não informada"} · {match.kind === "same-song" ? "mesma música provável" : "só o título"} ·{" "}
                      {match.status}
                    </span>
                  </span>
                  <Link href={`/admin/catalogo/${encodeURIComponent(match.id)}`} className="font-medium underline underline-offset-3">
                    Abrir
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Sugestões de classificação e vídeo">
          {hasSuggestedClassification(suggested) ? (
            <ul className="space-y-0.5 text-sm">
              {suggested.moments.length > 0 && <li>Momentos: {suggested.moments.map(momentLabel).join(", ")}</li>}
              {suggested.seasons.length > 0 && <li>Tempos: {suggested.seasons.map(seasonLabel).join(", ")}</li>}
              {suggested.celebrations.length > 0 && <li>Celebrações: {suggested.celebrations.map(celebrationLabel).join(", ")}</li>}
              {suggested.themes.length > 0 && <li>Temas: {suggested.themes.map(themeLabel).join(", ")}</li>}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sem sugestão de classificação.</p>
          )}
          {submission.video ? (
            <div className="space-y-1 text-sm">
              <p>
                Vídeo {submission.video.ownPerformance ? "declarado como apresentação do colaborador" : "de referência"}
                {submission.video.title ? `: ${submission.video.title}` : ""}
              </p>
              <VideoReference videoId={submission.video.videoId} title={snapshot.title} videoTitle={submission.video.title} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem vídeo.</p>
          )}
        </Panel>

        <Panel title="Histórico">
          <SubmissionTimeline history={submission.history} />
          {submission.previousVersions.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">Versões anteriores ({submission.previousVersions.length})</summary>
              <ul className="mt-2 space-y-1">
                {submission.previousVersions.map((entry) => (
                  <li key={entry.version}>
                    Versão {entry.version} · {formatDateTime(entry.submittedAt)} · {entry.snapshot.title} · tom {entry.snapshot.originalKey}
                    {entry.snapshot.chordPro ? ` · ${entry.snapshot.chordPro.length} caracteres de cifra` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Panel>
      </div>

      <div className="min-w-0 space-y-4">
        {submission.status === "approved" && submission.resultingCatalogSongId && (
          <ApprovedPanel api={api} submission={submission} />
        )}
        {decidable && ownSubmission && (
          <p className="rounded-lg border px-3 py-2 text-sm">Esta sugestão é sua: outra pessoa da equipe precisa decidir.</p>
        )}
        {decidable && !ownSubmission && (
          <>
            <ApprovePanel
              api={api}
              submission={submission}
              onApproved={(next) => updated(next, "Sugestão aprovada.")}
              onFailure={handleFailure}
            />
            <NotePanel
              title="Pedir correções"
              action="Pedir correções"
              hint="O colaborador vê esta orientação e pode enviar uma nova versão."
              disabled={submission.status !== "pending"}
              onSubmit={async (note) => {
                try {
                  updated(await api.requestChanges(submission, note), "Correções pedidas.");
                } catch (error) {
                  handleFailure(error);
                }
              }}
            />
            <NotePanel
              title="Recusar"
              action="Recusar sugestão"
              hint="A justificativa aparece para o colaborador. A música particular dele não muda."
              destructive
              onSubmit={async (note) => {
                try {
                  updated(await api.reject(submission, note), "Sugestão recusada.");
                } catch (error) {
                  handleFailure(error);
                }
              }}
            />
          </>
        )}
        {!decidable && submission.review && (
          <Panel title="Decisão">
            <p className="text-sm">
              {SUBMISSION_STATUS_LABELS[submission.status]} em {formatDateTime(submission.review.at)}
              {submission.review.mode === "complement" ? " como complemento de uma música existente" : ""}
              {submission.review.mode === "new" ? " como música nova" : ""}.
            </p>
            {submission.review.note && <p className="text-sm whitespace-pre-line">{submission.review.note}</p>}
          </Panel>
        )}
      </div>
    </div>
  );
}

function NotePanel({
  title,
  action,
  hint,
  destructive,
  disabled,
  onSubmit,
}: {
  title: string;
  action: string;
  hint: string;
  destructive?: boolean;
  disabled?: boolean;
  onSubmit: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!note.trim()) {
      setError("Registre a justificativa.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit(note.trim());
      setNote("");
    } catch (cause) {
      setError(getLibraryErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <Panel title={title}>
        <p className="text-sm text-muted-foreground">{disabled ? "Disponível só para sugestões em análise." : hint}</p>
        <label className="block space-y-1 text-sm font-medium">
          Justificativa
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={SUBMISSION_TEXT_MAX}
            disabled={disabled}
            className="min-h-16 font-normal"
          />
        </label>
        {error && <FormError message={error} />}
        <Button type="submit" size="lg" variant={destructive ? "destructive" : "outline"} disabled={pending || disabled}>
          {pending ? "Gravando…" : action}
        </Button>
      </Panel>
    </form>
  );
}

function ApprovePanel({
  api,
  submission,
  onApproved,
  onFailure,
}: {
  api: SubmissionAdminApi;
  submission: AdminSubmission;
  onApproved: (submission: AdminSubmission) => void;
  onFailure: (error: unknown) => never;
}) {
  const { snapshot, rights } = submission;
  const sameSong = submission.duplicates.filter((match) => match.kind === "same-song");
  const contentLicensed =
    Boolean(snapshot.chordPro?.trim()) &&
    snapshot.contentType !== "external-link" &&
    canLicenseContent(rights.status) &&
    rights.license.display &&
    rights.license.reproduce;

  // Um pedido por decisão: repetir (resposta perdida) não cria uma segunda música.
  const [requestId] = useState(createRequestId);
  const [mode, setMode] = useState<"new" | "complement">(sameSong.length > 0 ? "complement" : "new");
  const [title, setTitle] = useState(snapshot.title);
  const [artist, setArtist] = useState(snapshot.artist);
  const [originalKey, setOriginalKey] = useState<MusicalKey>(snapshot.originalKey);
  const [compositionReference, setCompositionReference] = useState("");
  const [publishContent, setPublishContent] = useState(false);
  const [shareContent, setShareContent] = useState(false);
  const [publish, setPublish] = useState(true);
  const [includeClassification, setIncludeClassification] = useState(false);
  const [includeVideo, setIncludeVideo] = useState(false);
  const [videoVerified, setVideoVerified] = useState(false);
  const [credit, setCredit] = useState(submission.credit.show);
  const [creditName, setCreditName] = useState(submission.credit.name ?? "");
  const [targetId, setTargetId] = useState(sameSong[0]?.id ?? submission.duplicates[0]?.id ?? "");
  const [targetInput, setTargetInput] = useState(targetId);
  const [target, setTarget] = useState<CatalogSong | null>(null);
  const [fillOriginalKey, setFillOriginalKey] = useState(false);
  const [duplicatesChecked, setDuplicatesChecked] = useState(false);
  const [rightsChecked, setRightsChecked] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // O complemento mostra a música de destino com a revisão atual, enviada junto da aprovação.
  useEffect(() => {
    if (mode !== "complement" || !targetId) {
      return;
    }
    let active = true;
    api.getCatalogSong(targetId).then(
      (song) => active && setTarget(song),
      (cause: unknown) => active && setError(getLibraryErrorMessage(cause)),
    );
    return () => {
      active = false;
    };
  }, [api, mode, targetId]);

  const currentTarget = target?.id === targetId ? target : null;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!duplicatesChecked || (mode === "new" && !rightsChecked)) {
      setError(mode === "new" ? "Confira as duplicatas e os direitos antes de aprovar." : "Confira as duplicatas antes de aprovar.");
      return;
    }
    if (includeVideo && !videoVerified) {
      setError("Confirme que o vídeo corresponde a esta música.");
      return;
    }
    if (mode === "complement" && !currentTarget) {
      setError("Escolha a música do catálogo que será complementada.");
      return;
    }
    setPending(true);
    try {
      const request =
        mode === "new"
          ? {
              mode: "new" as const,
              requestId,
              editorial: {
                title: title.trim(),
                artist: artist.trim(),
                originalKey,
                ...(compositionReference.trim() ? { compositionReference: compositionReference.trim() } : {}),
              },
              publishContent,
              shareContent: publishContent && shareContent,
              publish,
              includeClassification,
              includeVideo,
              videoVerified,
              creditName: credit && submission.credit.show ? creditName : null,
              knownDuplicateIds: submission.duplicates.map((match) => match.id),
              duplicatesChecked: true as const,
              rightsChecked: true as const,
              ...(note.trim() ? { note: note.trim() } : {}),
            }
          : {
              mode: "complement" as const,
              requestId,
              targetCatalogSongId: currentTarget!.id,
              targetRevision: currentTarget!.revision,
              includeClassification,
              includeVideo,
              videoVerified,
              fillOriginalKey,
              duplicatesChecked: true as const,
              ...(note.trim() ? { note: note.trim() } : {}),
            };
      const result = await api.approve(submission, request);
      onApproved(result.submission);
    } catch (cause) {
      setError(
        cause instanceof LibraryError && (cause.code === "remote-unavailable" || cause.code === "write-uncertain")
          ? "Não foi possível confirmar a aprovação. Tente de novo: o mesmo pedido não cria uma segunda música."
          : getLibraryErrorMessage(cause),
      );
      try {
        onFailure(cause);
      } catch {
        // O erro já está no formulário; a recarga acontece quando a sugestão mudou.
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <Panel title="Aprovar" className="border-primary/40">
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Como aprovar</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="modo-aprovacao" className="mt-1" checked={mode === "new"} onChange={() => setMode("new")} />
            <span>Como música nova do catálogo</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="modo-aprovacao"
              className="mt-1"
              checked={mode === "complement"}
              onChange={() => setMode("complement")}
            />
            <span>Vincular a uma música existente (complemento)</span>
          </label>
        </fieldset>

        {mode === "new" ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Ajustes editoriais valem só para o catálogo: a música particular do colaborador não muda.
            </p>
            <label className="block space-y-1 text-sm font-medium">
              Título
              <Input value={title} onChange={(event) => setTitle(event.target.value)} className="font-normal" />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Autoria
              <Input value={artist} onChange={(event) => setArtist(event.target.value)} className="font-normal" />
            </label>
            <div className="grid grid-cols-[auto_1fr] items-end gap-3">
              <label className="block space-y-1 text-sm font-medium">
                Tom
                <NativeSelect value={originalKey} onChange={(event) => setOriginalKey(event.target.value as MusicalKey)}>
                  {MUSICAL_KEYS.map((key) => (
                    <NativeSelectOption key={key} value={key}>
                      {key}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <label className="block min-w-0 space-y-1 text-sm font-medium">
                Referência da composição
                <Input
                  value={compositionReference}
                  onChange={(event) => setCompositionReference(event.target.value)}
                  placeholder="Ex.: Hinário Litúrgico, v. 2"
                  className="font-normal"
                />
              </label>
            </div>

            <fieldset className="space-y-1.5 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">Publicação da letra e da cifra</legend>
              <Check checked={publishContent} onChange={setPublishContent} disabled={!contentLicensed}>
                Publicar a letra e a cifra (autorização de exibição e reprodução declarada)
              </Check>
              <Check
                checked={shareContent}
                onChange={setShareContent}
                disabled={!publishContent || !rights.license.redistribute}
              >
                Permitir a cifra em links públicos de repertórios
              </Check>
              {!contentLicensed && (
                <p className="text-xs text-muted-foreground">Sem autorização declarada: só metadados (título, autoria, tom).</p>
              )}
            </fieldset>
            <Check checked={publish} onChange={setPublish}>
              Publicar agora (sem isso, fica como rascunho em Administrar catálogo)
            </Check>
          </div>
        ) : (
          <div className="space-y-3">
            {submission.duplicates.length > 0 && (
              <label className="block space-y-1 text-sm font-medium">
                Música do catálogo
                <NativeSelect
                  value={submission.duplicates.some((match) => match.id === targetId) ? targetId : ""}
                  onChange={(event) => {
                    setTargetId(event.target.value);
                    setTargetInput(event.target.value);
                  }}
                  className="w-full"
                >
                  <NativeSelectOption value="">Outra (informe o identificador)</NativeSelectOption>
                  {submission.duplicates.map((match) => (
                    <NativeSelectOption key={match.id} value={match.id}>
                      {match.title} · {match.artist || "sem autoria"}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            )}
            <label className="block space-y-1 text-sm font-medium">
              Identificador da música no catálogo
              <Input
                value={targetInput}
                onChange={(event) => setTargetInput(event.target.value)}
                onBlur={() => setTargetId(targetInput.trim())}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setTargetId(targetInput.trim());
                  }
                }}
                className="font-mono text-xs font-normal"
              />
            </label>
            {currentTarget && (
              <p className="text-xs text-muted-foreground">
                Revisão {currentTarget.revision} · {currentTarget.liturgy ? `classificação ${currentTarget.liturgy.reviewStatus === "reviewed" ? "conferida" : "não conferida"}` : "sem classificação"} ·{" "}
                {currentTarget.video ? "já tem vídeo" : "sem vídeo"} · {currentTarget.originalKey ? `tom ${currentTarget.originalKey}` : "sem tom"}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Título, autoria, cifra e direitos da música oficial nunca são substituídos. Uma cifra alternativa se edita à mão em
              Administrar catálogo.
            </p>
            <Check checked={fillOriginalKey} onChange={setFillOriginalKey} disabled={!currentTarget || Boolean(currentTarget.originalKey)}>
              Completar o tom original ({snapshot.originalKey})
            </Check>
          </div>
        )}

        <Check
          checked={includeClassification}
          onChange={setIncludeClassification}
          disabled={!hasSuggestedClassification(submission.suggestedClassification)}
        >
          Incluir a classificação sugerida (entra como “não conferida”)
        </Check>
        <Check checked={includeVideo} onChange={setIncludeVideo} disabled={!submission.video}>
          Incluir o vídeo
        </Check>
        {includeVideo && (
          <Check checked={videoVerified} onChange={setVideoVerified}>
            Assisti e confirmo que o vídeo corresponde a esta música
          </Check>
        )}
        {mode === "new" && submission.credit.show && (
          <div className="space-y-1.5">
            <Check checked={credit} onChange={setCredit}>
              Exibir “Enviado por”
            </Check>
            {credit && (
              <Input value={creditName} onChange={(event) => setCreditName(event.target.value)} aria-label="Nome público" />
            )}
          </div>
        )}

        <div className="space-y-1.5 border-t pt-3">
          <Check checked={duplicatesChecked} onChange={setDuplicatesChecked}>
            Conferi as possíveis duplicatas
          </Check>
          {mode === "new" && (
            <Check checked={rightsChecked} onChange={setRightsChecked}>
              Conferi a declaração de direitos
            </Check>
          )}
        </div>
        <label className="block space-y-1 text-sm font-medium">
          Nota para o colaborador (opcional)
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={SUBMISSION_TEXT_MAX} className="min-h-14 font-normal" />
        </label>
        {error && <FormError message={error} />}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Aprovando…" : mode === "new" ? "Aprovar como música nova" : "Aprovar como complemento"}
        </Button>
      </Panel>
    </form>
  );
}

/** Depois de aprovada: link para a música e retirada de vídeo ou crédito (contestação). */
function ApprovedPanel({ api, submission }: { api: SubmissionAdminApi; submission: AdminSubmission }) {
  const [song, setSong] = useState<CatalogSong | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const songId = submission.resultingCatalogSongId!;

  useEffect(() => {
    let active = true;
    api.getCatalogSong(songId).then(
      (loaded) => active && setSong(loaded),
      (cause: unknown) => active && setError(getLibraryErrorMessage(cause)),
    );
    return () => {
      active = false;
    };
  }, [api, songId]);

  const contribution = song?.contributions?.find((entry) => entry.submissionId === submission.id);
  const hasCredit = Boolean(song?.contributions?.some((entry) => entry.publicCredit));

  async function remove(removal: { video: boolean; credit: boolean }): Promise<void> {
    if (!song) return;
    setPending(true);
    setError(null);
    try {
      setSong(await api.removeFromCatalogSong(song, removal));
      showToast(removal.video ? "Vídeo removido da música." : "Crédito removido da música.");
    } catch (cause) {
      setError(getLibraryErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel title="Música no catálogo">
      {!song && !error && <ContentSkeleton />}
      {song && (
        <>
          <p className="text-sm">
            <span className="font-medium">{song.title}</span> · {song.status === "published" ? "publicada" : song.status === "draft" ? "rascunho" : "despublicada"}
          </p>
          {contribution && <p className="text-xs text-muted-foreground">Aplicado desta sugestão: {contribution.fields.join(", ") || "nenhum campo"}.</p>}
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/catalogo/${encodeURIComponent(song.id)}`} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              Editar no catálogo
            </Link>
            {song.status === "published" && (
              <Link href={`/catalogo/${encodeURIComponent(song.id)}`} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                Ver como visitante
              </Link>
            )}
          </div>
          <div className="space-y-1.5 border-t pt-3">
            <p className="text-sm font-medium">Pedido de retirada ou contestação</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="lg" disabled={pending || !song.video} onClick={() => void remove({ video: true, credit: false })}>
                Remover vídeo
              </Button>
              <Button variant="outline" size="lg" disabled={pending || !hasCredit} onClick={() => void remove({ video: false, credit: true })}>
                Remover crédito
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Para tirar a letra e a cifra, despublique ou edite a música em Administrar catálogo.</p>
          </div>
        </>
      )}
      {error && <FormError message={error} />}
    </Panel>
  );
}
