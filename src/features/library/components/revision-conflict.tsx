"use client";

import { ClipboardCopy, Eye, RotateCcw, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { FormError } from "@/components/layout/form-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { showToast } from "@/lib/utils/toast";

import { getLibraryErrorMessage, LibraryError, type LibraryErrorCode } from "../domain/library-errors";

type CurrentState<T> =
  | { status: "hidden" }
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "missing" }
  | { status: "error"; message: string };

interface RevisionConflictProps<T> {
  message: string;
  /** Busca a versão atual no servidor; `null` quando o documento foi excluído. */
  loadCurrent: () => Promise<T | null>;
  renderCurrent: (current: T) => ReactNode;
  missingCode: LibraryErrorCode;
  draftText: string;
  /** Troca o rascunho pela versão atual. Só acontece depois de confirmação. */
  onDiscard: (current: T) => void;
}

/**
 * Aviso de conflito de versão. O rascunho fica intacto até uma decisão explícita:
 * nada é mesclado, substituído ou reenviado sozinho.
 */
export function RevisionConflict<T>({
  message,
  loadCurrent,
  renderCurrent,
  missingCode,
  draftText,
  onDiscard,
}: RevisionConflictProps<T>) {
  const [current, setCurrent] = useState<CurrentState<T>>({ status: "hidden" });
  const [showDraft, setShowDraft] = useState(false);

  async function showCurrent(): Promise<void> {
    setCurrent({ status: "loading" });
    try {
      const value = await loadCurrent();
      setCurrent(value ? { status: "ready", value } : { status: "missing" });
    } catch (error) {
      setCurrent({ status: "error", message: getLibraryErrorMessage(error) });
    }
  }

  async function copyDraft(): Promise<void> {
    try {
      await navigator.clipboard.writeText(draftText);
      showToast("Rascunho copiado.");
    } catch {
      // Sem área de transferência (por exemplo, fora de HTTPS), o texto fica visível para copiar.
      setShowDraft(true);
      showToast("Não foi possível copiar automaticamente. O rascunho está abaixo.", "error");
    }
  }

  async function discard(): Promise<void> {
    const value = await loadCurrent();
    if (!value) {
      throw new LibraryError(missingCode);
    }
    onDiscard(value);
    showToast("Versão atual carregada.");
  }

  return (
    <section role="alert" className="space-y-3 rounded-lg border border-destructive/40 p-3 text-sm">
      <p className="flex items-start gap-2 font-medium">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        {message}
      </p>
      <p className="text-muted-foreground">
        Nada foi salvo. Seu texto continua no formulário e nada será substituído sem a sua decisão.
        Para sair sem salvar, use “Cancelar”.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="lg" onClick={() => void showCurrent()}>
          <Eye data-icon="inline-start" aria-hidden />
          Ver versão atual
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => void copyDraft()}>
          <ClipboardCopy data-icon="inline-start" aria-hidden />
          Copiar meu rascunho
        </Button>
        <ConfirmDialog
          trigger={
            <Button type="button" variant="outline" size="lg">
              <RotateCcw data-icon="inline-start" aria-hidden />
              Descartar rascunho
            </Button>
          }
          title="Descartar seu rascunho?"
          description="O texto que você digitou será apagado do formulário e trocado pela versão atual salva. Copie o rascunho antes, se quiser guardá-lo."
          confirmLabel="Descartar e carregar a versão atual"
          onConfirm={discard}
        />
      </div>

      {current.status === "loading" && <p className="text-muted-foreground">Carregando a versão atual…</p>}
      {current.status === "error" && <FormError message={current.message} />}
      {current.status === "missing" && (
        <p>Este conteúdo foi excluído em outro dispositivo. Copie o rascunho se quiser guardá-lo.</p>
      )}
      {current.status === "ready" && (
        <div className="rounded-lg border bg-card p-3">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">Versão atual no servidor</h3>
          {renderCurrent(current.value)}
        </div>
      )}

      {showDraft && (
        <Textarea readOnly value={draftText} aria-label="Seu rascunho" className="min-h-32 font-mono text-xs" />
      )}
    </section>
  );
}
