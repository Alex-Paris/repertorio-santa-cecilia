import { cn } from "cn";

import { SUBMISSION_STATUS_LABELS, type SubmissionHistoryEntry, type SubmissionStatus } from "../domain/submission";

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  pending: "border-gold/60 bg-gold/10 text-gold-strong",
  needs_changes: "border-gold-strong/70 bg-card text-gold-strong",
  approved: "border-primary/50 bg-primary/10 text-primary",
  rejected: "border-destructive/40 bg-destructive/5 text-destructive",
  withdrawn: "border-border bg-muted text-muted-foreground",
};

/** Situação da sugestão sempre com o nome por extenso: a cor só reforça. */
export function SubmissionStatusBadge({ status, className }: { status: SubmissionStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[status],
        className,
      )}
    >
      {SUBMISSION_STATUS_LABELS[status]}
    </span>
  );
}

export const HISTORY_LABELS: Record<SubmissionHistoryEntry["action"], string> = {
  submitted: "Enviada",
  resubmit: "Nova versão enviada",
  withdraw: "Retirada",
  approve: "Aprovada",
  reject: "Recusada",
  request_changes: "Correções pedidas",
};

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

/** Linha do tempo da sugestão, sem identificar quem decidiu na administração. */
export function SubmissionTimeline({ history }: { history: readonly SubmissionHistoryEntry[] }) {
  return (
    <ol className="space-y-2 border-l-2 border-border pl-4 text-sm">
      {history.map((entry, index) => (
        <li key={`${entry.at}-${index}`} className="relative">
          <span aria-hidden className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-gold" />
          <p>
            <span className="font-medium">{HISTORY_LABELS[entry.action]}</span>
            <span className="text-muted-foreground">
              {" "}
              · versão {entry.version} · {formatDateTime(entry.at)}
              {entry.actor === "admin" ? " · equipe do catálogo" : ""}
            </span>
          </p>
          {entry.note && <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{entry.note}</p>}
        </li>
      ))}
    </ol>
  );
}
