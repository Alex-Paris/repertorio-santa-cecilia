"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { FormError } from "@/components/layout/form-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getLibraryErrorMessage } from "@/features/library/domain/library-errors";

import { createCatalogAdminApi, type ImportPreviewResponse, type ImportResultResponse } from "../data/catalog-admin-api";

const STATUS_LABELS = {
  new: "Será criada como rascunho",
  existing: "Já importada antes",
  duplicate: "Possível duplicata",
  invalid: "Inválida",
} as const;

interface CatalogImportProps {
  userId: string;
  /** Catálogo editorial inicial que acompanha o projeto. */
  bundled: unknown;
}

/** Importação em dois passos: prévia sem gravar e confirmação explícita. */
export function CatalogImport({ userId, bundled }: CatalogImportProps) {
  const api = useMemo(() => createCatalogAdminApi(userId), [userId]);
  const textId = useId();
  const confirmId = useId();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [result, setResult] = useState<ImportResultResponse | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function change(next: string): void {
    setText(next);
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError(null);
  }

  function parse(): unknown {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("O conteúdo não é um JSON válido.");
    }
  }

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error && caught.message.startsWith("O conteúdo") ? caught.message : getLibraryErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function readFile(file: File | undefined): Promise<void> {
    if (file) {
      change(await file.text());
    }
  }

  const creatable = preview?.counts.new ?? 0;

  return (
    <div className="space-y-6">
      <section aria-labelledby="importar-origem" className="space-y-3">
        <h2 id="importar-origem" className="font-display text-lg font-semibold">
          1. Arquivo
        </h2>
        <p className="text-sm text-muted-foreground">
          Formato <code>repertorio-web/catalogo-editorial</code>, versão 1. Não aceita letra, cifra nem partitura: só
          metadados com a fonte de cada registro.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => change(JSON.stringify(bundled, null, 2))}>
            Usar o catálogo editorial inicial
          </Button>
          <label className="inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm font-medium hover:bg-muted">
            Escolher arquivo JSON
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => void readFile(event.target.files?.[0])}
            />
          </label>
        </div>
        <div className="space-y-1">
          <label htmlFor={textId} className="block text-sm font-medium">
            Conteúdo
          </label>
          <Textarea
            id={textId}
            value={text}
            onChange={(event) => change(event.target.value)}
            rows={8}
            spellCheck={false}
            className="font-mono text-xs"
          />
        </div>
        <Button type="button" disabled={!text.trim() || busy} onClick={() => void run(async () => setPreview(await api.previewImport(parse())))}>
          {busy && !preview ? "Conferindo…" : "Ver prévia"}
        </Button>
      </section>

      {error && <FormError message={error} />}

      {preview && !result && (
        <section aria-labelledby="importar-previa" className="space-y-3">
          <h2 id="importar-previa" className="font-display text-lg font-semibold">
            2. Prévia
          </h2>
          <p className="text-sm" role="status">
            {preview.counts.new} novas · {preview.counts.existing} já importadas · {preview.counts.duplicate} possíveis
            duplicatas · {preview.counts.invalid} inválidas. Nada foi gravado.
          </p>
          <ImportEntries entries={preview.entries} />
          {creatable > 0 ? (
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-start gap-2 text-sm">
                <input
                  id={confirmId}
                  type="checkbox"
                  className="mt-1 size-4"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <label htmlFor={confirmId}>
                  Conferi a prévia. Criar {creatable === 1 ? "1 rascunho" : `${creatable} rascunhos`}, sem publicar, sem
                  exibir letra ou cifra e com as classificações marcadas como não conferidas.
                </label>
              </div>
              <Button
                type="button"
                disabled={!confirmed || busy}
                onClick={() => void run(async () => setResult(await api.commitImport(parse())))}
              >
                {busy ? "Importando…" : "Importar rascunhos"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Não há registros novos para importar.</p>
          )}
        </section>
      )}

      {result && (
        <section aria-labelledby="importar-resultado" className="space-y-3">
          <h2 id="importar-resultado" className="font-display text-lg font-semibold">
            Importação concluída
          </h2>
          <p role="status" className="text-sm">
            {result.created.length === 1 ? "1 rascunho criado" : `${result.created.length} rascunhos criados`}. As
            músicas existentes não foram alteradas. Revise cada rascunho antes de publicar.
          </p>
          {result.created.length > 0 && (
            <ul className="divide-y rounded-xl border bg-card text-sm">
              {result.created.map((song) => (
                <li key={song.id} className="px-4 py-2.5">
                  <Link href={`/admin/catalogo/${song.id}`} className="font-medium underline underline-offset-3">
                    {song.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function ImportEntries({ entries }: { entries: ImportPreviewResponse["entries"] }) {
  return (
    <ol className="divide-y rounded-xl border bg-card text-sm">
      {entries.map((entry) => (
        <li key={entry.index} className="space-y-1 px-4 py-3">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-medium wrap-break-word">{entry.title || `Registro ${entry.index + 1}`}</span>
            <span className={entry.status === "new" ? "text-xs font-medium" : "text-xs text-muted-foreground"}>
              {STATUS_LABELS[entry.status]}
            </span>
          </p>
          <p className="text-muted-foreground">{entry.artist || "Autoria não informada"}</p>
          {entry.reason && <p>{entry.reason}</p>}
          {entry.existing && (
            <p>
              Existente:{" "}
              <Link href={`/admin/catalogo/${entry.existing.id}`} className="underline underline-offset-3">
                {entry.existing.title}
              </Link>
              {entry.existing.artist && ` (${entry.existing.artist})`}
            </p>
          )}
          {entry.sources.length > 0 && (
            <ul className="text-xs text-muted-foreground">
              {entry.sources.map((source) => (
                <li key={`${source.title}-${source.url ?? ""}`} className="wrap-break-word">
                  Fonte:{" "}
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                      {source.title}
                    </a>
                  ) : (
                    source.title
                  )}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
