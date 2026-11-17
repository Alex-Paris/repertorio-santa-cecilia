"use client";

import { cn } from "cn";
import { ChevronRight, Inbox, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { FormError } from "@/components/layout/form-error";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { getLibraryErrorMessage, LibraryError } from "@/features/library/domain/library-errors";
import { KeyLabel } from "@/features/songs/components/key-label";
import { showToast } from "@/lib/utils/toast";

import { createSubmissionApi } from "../data/submission-api";
import {
  RIGHTS_STATUS_LABELS,
  type MySubmission,
  type SubmissionSummary,
} from "../domain/submission";
import { SubmissionForm } from "./submission-form";
import { formatDate, formatDateTime, SubmissionStatusBadge, SubmissionTimeline } from "./submission-ui";

type ListState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; submissions: SubmissionSummary[] };

/** "Minhas sugestões": só as da própria conta, da mais recente para a mais antiga. */
export function MySubmissions({ userId }: { userId: string }) {
  const api = useMemo(() => createSubmissionApi(userId), [userId]);
  const [state, setState] = useState<ListState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    api.listMine(controller.signal).then(
      (submissions) => setState({ status: "ready", submissions }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ status: "error", message: getLibraryErrorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [api]);

  if (state.status === "loading") return <ContentSkeleton />;
  if (state.status === "error") return <FormError message={state.message} />;
  if (state.submissions.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Nenhuma sugestão enviada"
        description="Abra uma música da sua biblioteca e escolha “Sugerir para o catálogo”. Ela continua particular enquanto a equipe analisa."
      />
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {state.submissions.map((submission) => (
        <li key={submission.id}>
          <Link
            href={`/conta/sugestoes/${encodeURIComponent(submission.id)}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium wrap-break-word">{submission.title}</p>
              <p className="text-sm text-muted-foreground">
                {submission.artist || "Autoria não informada"} · enviada em {formatDate(submission.submittedAt)}
                {submission.version > 1 ? ` · versão ${submission.version}` : ""}
              </p>
              {submission.reviewNote && (
                <p className="mt-1 line-clamp-2 text-sm wrap-break-word">
                  <span className="text-muted-foreground">Equipe: </span>
                  {submission.reviewNote}
                </p>
              )}
              {submission.resultingCatalogSong && (
                <p className="mt-1 text-sm text-primary">
                  {submission.resultingCatalogSong.published ? "No catálogo" : "Em preparação no catálogo"}:{" "}
                  {submission.resultingCatalogSong.title}
                </p>
              )}
            </div>
            <SubmissionStatusBadge status={submission.status} />
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

type DetailState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; submission: MySubmission };

/** Detalhe da própria sugestão: situação, justificativa, histórico, retirar e reenviar. */
export function MySubmissionDetail({ userId, submissionId }: { userId: string; submissionId: string }) {
  const api = useMemo(() => createSubmissionApi(userId), [userId]);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [editing, setEditing] = useState(false);
  const [reload, setReload] = useState(0);

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
  if (state.status === "error") {
    return (
      <div className="space-y-3">
        <FormError message={state.message} />
        <Link href="/conta/sugestoes" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Minhas sugestões
        </Link>
      </div>
    );
  }

  const { submission } = state;
  const canWithdraw = submission.status === "pending" || submission.status === "needs_changes";

  async function withdraw(): Promise<void> {
    try {
      const updated = await api.withdraw(submission);
      setState({ status: "ready", submission: updated });
      showToast("Sugestão retirada da análise.");
    } catch (error) {
      // Mudou em outro lugar (decisão da equipe, outra aba): mostra o estado atual.
      if (error instanceof LibraryError && (error.code === "revision-conflict" || error.code === "submission-already-reviewed")) {
        setReload((value) => value + 1);
      }
      throw error;
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <section className="space-y-3 rounded-xl border bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold wrap-break-word text-heading">{submission.snapshot.title}</h2>
            <p className="text-sm text-muted-foreground">
              {submission.snapshot.artist || "Autoria não informada"} · tom <KeyLabel musicalKey={submission.snapshot.originalKey} /> ·
              versão {submission.version}
            </p>
          </div>
          <SubmissionStatusBadge status={submission.status} />
        </div>

        {submission.status === "pending" && (
          <p className="text-sm">A equipe do catálogo ainda vai analisar. Nada foi publicado.</p>
        )}
        {submission.status === "needs_changes" && (
          <div className="space-y-2 rounded-lg border border-gold/60 bg-gold/10 p-3 text-sm">
            <p className="font-medium">A equipe pediu correções</p>
            {submission.reviewNote && <p className="whitespace-pre-line">{submission.reviewNote}</p>}
            <p className="text-muted-foreground">
              Corrija a sua música e envie uma nova versão. A versão anterior continua guardada no histórico.
            </p>
          </div>
        )}
        {submission.status === "rejected" && (
          <div className="space-y-1 rounded-lg border p-3 text-sm">
            <p className="font-medium">A sugestão não foi aceita</p>
            {submission.reviewNote && <p className="whitespace-pre-line">{submission.reviewNote}</p>}
          </div>
        )}
        {submission.status === "approved" && (
          <div className="space-y-1 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
            <p className="font-medium">Sugestão aprovada</p>
            {submission.reviewNote && <p className="whitespace-pre-line">{submission.reviewNote}</p>}
            {submission.resultingCatalogSong &&
              (submission.resultingCatalogSong.published ? (
                <Link
                  href={`/catalogo/${encodeURIComponent(submission.resultingCatalogSong.id)}`}
                  className="inline-block font-medium underline underline-offset-3"
                >
                  Ver “{submission.resultingCatalogSong.title}” no catálogo
                </Link>
              ) : (
                <p className="text-muted-foreground">A música oficial ainda está em preparação pela equipe.</p>
              ))}
          </div>
        )}
        {submission.status === "withdrawn" && (
          <p className="text-sm text-muted-foreground">
            Você retirou esta sugestão. Ficou guardado só o mínimo para o histórico; a cifra enviada foi descartada.
          </p>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Direitos</dt>
          <dd className="min-w-0">{RIGHTS_STATUS_LABELS[submission.rights.status]}</dd>
          <dt className="text-muted-foreground">Vídeo</dt>
          <dd className="min-w-0">
            {submission.video ? (
              <a
                href={`https://www.youtube.com/watch?v=${submission.video.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-3"
              >
                {submission.video.title || "YouTube"}
                <span className="sr-only"> (abre em outra aba)</span>
              </a>
            ) : (
              "Nenhum"
            )}
          </dd>
          <dt className="text-muted-foreground">Crédito</dt>
          <dd className="min-w-0 wrap-break-word">{submission.credit.show ? `Enviado por: ${submission.credit.name}` : "Sem crédito público"}</dd>
          <dt className="text-muted-foreground">Enviada</dt>
          <dd>{formatDateTime(submission.submittedAt)}</dd>
        </dl>

        <div className="flex flex-wrap gap-2">
          {submission.status === "needs_changes" && !editing && (
            <>
              <Link
                href={`/musicas/${encodeURIComponent(submission.personalSongId)}/editar`}
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                Editar a música
              </Link>
              <Button size="lg" onClick={() => setEditing(true)}>
                Enviar nova versão
              </Button>
            </>
          )}
          {canWithdraw && (
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="lg">
                  <Undo2 data-icon="inline-start" aria-hidden />
                  Retirar sugestão
                </Button>
              }
              title="Retirar esta sugestão?"
              description="Ela sai da fila de análise e a cifra enviada é descartada. A sua música continua na biblioteca."
              confirmLabel="Retirar sugestão"
              onConfirm={withdraw}
            />
          )}
        </div>
      </section>

      {editing && submission.status === "needs_changes" && (
        <section aria-label="Nova versão" className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-heading">Nova versão</h2>
          <p className="text-sm text-muted-foreground">
            O conteúdo é lido de novo da sua música particular. Confira a prévia antes de enviar.
          </p>
          <SubmissionForm
            userId={userId}
            songId={submission.personalSongId}
            resubmitting={submission}
            onResubmitted={(updated) => {
              setEditing(false);
              setState({ status: "ready", submission: updated });
            }}
          />
        </section>
      )}

      <section className="space-y-2 rounded-xl border bg-card p-4 md:p-5">
        <h2 className="font-display text-lg font-semibold text-heading">Histórico</h2>
        <SubmissionTimeline history={submission.history} />
        {submission.previousVersions.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Versões anteriores guardadas:{" "}
            {submission.previousVersions.map((entry) => `${entry.version} (${formatDate(entry.submittedAt)})`).join(", ")}.
          </p>
        )}
      </section>
    </div>
  );
}
