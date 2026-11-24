"use client";

import { cn } from "cn";
import { Copy, ExternalLink, Info, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { FormError } from "@/components/layout/form-error";
import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LibraryGate } from "@/features/library/components/library-gate";
import { findLibrarySong, type CatalogSongView } from "@/features/library/domain/library";
import { accountLibrary } from "@/features/library/data/browser-library";
import { getLibraryErrorMessage, LibraryError } from "@/features/library/domain/library-errors";
import { RepertoireNotFound } from "@/features/repertoires/components/repertoire-not-found";
import { formatShortDate } from "@/features/liturgy/domain/calendar";
import { momentLabel } from "@/features/liturgy/domain/vocabulary";
import type { Repertoire, RepertoireId } from "@/features/repertoires/domain/repertoire";
import { sortRepertoireItems } from "@/features/repertoires/services/repertoire-service";
import { KeyLabel } from "@/features/songs/components/key-label";
import { formatSongCount, type Song } from "@/features/songs/domain/song";
import { transposeKey } from "@/features/songs/domain/transposition";
import { showToast } from "@/lib/utils/toast";

import { createShareApi, type ShareApi } from "../data/share-api";
import {
  RIGHTS_DECLARATION_VERSION,
  type SharePreview,
  type ShareSelection,
  type ShareSummary,
} from "../domain/public-share";
import { describeShareContent } from "./share-item-status";

const SECTION = "rounded-xl border bg-card p-4";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function toSelection(selected: ReadonlySet<string>, includeMassDate: boolean): ShareSelection {
  return {
    authorizations: [...selected].map((songId) => ({
      songId,
      confirmed: true as const,
      declarationVersion: RIGHTS_DECLARATION_VERSION,
    })),
    // Só vai no pedido quando escolhido: sem isto, a data da celebração não é publicada.
    ...(includeMassDate ? { includeMassDate: true } : {}),
  };
}

function getPublicUrl(path: string): string {
  return `${window.location.origin}${path}`;
}

function PrivacyNotice() {
  return (
    <p className="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      Qualquer pessoa com o link verá o que está nesta prévia, sem precisar de conta. Suas anotações
      e seus dados de conta nunca são publicados. Alterações futuras no repertório só aparecem no
      link quando você escolher “Atualizar publicação”. Quem recebe pode guardar uma cópia na própria conta;
      atualizar ou revogar o link não altera as cópias já salvas.
    </p>
  );
}

interface ShareCardProps {
  share: ShareSummary;
  onUpdate: () => void;
  onRevoke: () => Promise<void>;
}

function ShareCard({ share, onUpdate, onRevoke }: ShareCardProps) {
  const url = share.path ? getPublicUrl(share.path) : null;

  async function copy(): Promise<void> {
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copiado.");
    } catch {
      // Em conexões sem HTTPS o navegador não oferece a área de transferência.
      showToast("Não foi possível copiar. Selecione o link e copie manualmente.", "error");
    }
  }

  return (
    <li className={cn(SECTION, "space-y-3")}>
      <div>
        <h3 className="font-medium wrap-break-word">{share.name}</h3>
        <p className="text-sm text-muted-foreground">
          Publicado em {formatDate(share.publishedAt)} · {formatSongCount(share.itemCount)}
        </p>
      </div>

      {url && <Input readOnly value={url} aria-label={`Link público de ${share.name}`} className="h-10" />}

      {share.outdated && (
        <p className="text-sm">
          A biblioteca mudou depois desta publicação. O link continua mostrando a versão anterior até
          você atualizá-la.
        </p>
      )}
      {share.removedTitles.length > 0 && (
        <p className="text-sm">
          Ainda visíveis neste link, mas fora do repertório: {share.removedTitles.join(", ")}. Atualize a
          publicação ou revogue o link para retirá-las.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="lg" disabled={!url} onClick={() => void copy()}>
          <Copy data-icon="inline-start" aria-hidden />
          Copiar link
        </Button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="inline-flex h-9 items-center gap-1.5 px-1 text-sm underline underline-offset-3"
          >
            Abrir
            <ExternalLink className="size-4" aria-hidden />
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        )}
        <Button variant="outline" size="lg" onClick={onUpdate}>
          <RefreshCw data-icon="inline-start" aria-hidden />
          Atualizar publicação
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="lg">
              <Trash2 data-icon="inline-start" aria-hidden />
              Revogar
            </Button>
          }
          title={`Revogar o link de “${share.name}”?`}
          description="O link deixa de funcionar imediatamente e não pode ser reativado. A publicação é apagada; seu repertório privado e as cópias já salvas por outras pessoas continuam disponíveis."
          confirmLabel="Revogar link"
          onConfirm={onRevoke}
        />
      </div>
    </li>
  );
}

interface ShareComposeProps {
  repertoire: Repertoire;
  songs: readonly Song[];
  catalogSongs: readonly CatalogSongView[];
  target: ShareSummary | null;
  selected: ReadonlySet<string>;
  includeMassDate: boolean;
  pending: boolean;
  onToggle: (songId: string, checked: boolean) => void;
  onIncludeMassDate: (checked: boolean) => void;
  onPreview: () => void;
  onCancel: () => void;
}

function ShareCompose({
  repertoire,
  songs,
  catalogSongs,
  target,
  selected,
  includeMassDate,
  pending,
  onToggle,
  onIncludeMassDate,
  onPreview,
  onCancel,
}: ShareComposeProps) {
  const entries = sortRepertoireItems(repertoire.items).flatMap((item) => {
    const song = findLibrarySong({ songs: [...songs], catalogSongs: [...catalogSongs] }, item.source, item.songId);
    return song ? [{ item, song }] : [];
  });

  return (
    <section className={cn(SECTION, "space-y-4")}>
      <div>
        <h2 className="font-medium">{target ? "Atualizar publicação" : "Nova publicação"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Título, artista e tom de todas as músicas serão publicados. Uma cifra só é publicada se você
          confirmar, música por música, que pode distribuí-la. O tipo “Autorizada” não dispensa essa
          confirmação.
        </p>
      </div>

      <ul className="space-y-3">
        {entries.map(({ item, song }) => {
          if (item.source === "catalog") {
            return (
              <li key={item.id} className="text-sm">
                <p className="font-medium wrap-break-word">{song.title}</p>
                <p className="mt-1 text-muted-foreground">
                  Do catálogo: a cifra entra somente se a plataforma tiver direito de redistribuí-la.
                </p>
              </li>
            );
          }
          const canPublish = song.contentType !== "external-link" && Boolean(song.chordPro?.trim());
          const inputId = `share-rights-${item.id}`;

          return (
            <li key={item.id} className="text-sm">
              <p className="font-medium wrap-break-word">{song.title}</p>
              {canPublish ? (
                <label htmlFor={inputId} className="mt-1 flex items-start gap-2 text-muted-foreground">
                  <input
                    id={inputId}
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0"
                    checked={selected.has(song.id)}
                    onChange={(event) => onToggle(song.id, event.target.checked)}
                  />
                  <span>
                    Tenho os direitos ou a autorização necessária para distribuir publicamente a cifra de
                    “{song.title}”.
                  </span>
                </label>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  {song.contentType === "external-link"
                    ? "Link externo: só o endereço será publicado."
                    : "Sem cifra cadastrada: só título, artista e tom."}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {repertoire.mass && (
        <div className="rounded-lg border px-3 py-2.5 text-sm">
          <p>
            Este repertório é de uma missa. O nome da celebração (“{repertoire.mass.title}”) e o momento de cada
            música serão publicados.
          </p>
          <label htmlFor="share-mass-date" className="mt-2 flex items-start gap-2">
            <input
              id="share-mass-date"
              type="checkbox"
              className="mt-0.5 size-4 shrink-0"
              checked={includeMassDate}
              onChange={(event) => onIncludeMassDate(event.target.checked)}
            />
            <span>Publicar também a data da celebração ({formatShortDate(repertoire.mass.date)}).</span>
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="lg" className="h-10 px-4" disabled={pending} onClick={onPreview}>
          {pending ? "Gerando…" : "Ver prévia"}
        </Button>
        <Button variant="outline" size="lg" className="h-10 px-4" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </section>
  );
}

interface SharePreviewPanelProps {
  preview: SharePreview;
  isUpdate: boolean;
  pending: boolean;
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
}

function SharePreviewPanel({ preview, isUpdate, pending, onConfirm, onBack, onCancel }: SharePreviewPanelProps) {
  const { snapshot } = preview;

  return (
    <section className={cn(SECTION, "space-y-4")} aria-label="Prévia da publicação">
      <div>
        <p className="text-xs text-muted-foreground">Prévia: nada foi publicado ainda.</p>
        <h2 className="mt-1 text-lg font-semibold wrap-break-word">{snapshot.name}</h2>
        {snapshot.mass && (
          <p className="mt-1 text-sm">
            {snapshot.mass.title}
            {snapshot.mass.date && <span className="text-muted-foreground"> · {formatShortDate(snapshot.mass.date)}</span>}
          </p>
        )}
        {snapshot.description && (
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{snapshot.description}</p>
        )}
      </div>

      <ol className="divide-y">
        {snapshot.items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
            <span className="w-5 text-muted-foreground tabular-nums">{item.position}</span>
            <span className="min-w-0 flex-1 wrap-break-word">
              {item.moment && <span className="block text-xs text-muted-foreground">{momentLabel(item.moment)}</span>}
              {item.title} <span className="text-muted-foreground">· {item.artist}</span>
            </span>
            {item.content.kind !== "external-link" && item.originalKey && (
              <KeyLabel musicalKey={transposeKey(item.originalKey, item.transposeSemitones)} />
            )}
            <span className="text-xs text-muted-foreground">
              {item.content.kind === "external-link"
                ? item.content.sourceUrl
                : item.content.kind === "none"
                  ? "Somente título, artista e tom"
                  : describeShareContent(item.content)}
            </span>
          </li>
        ))}
      </ol>

      <PrivacyNotice />

      <div className="flex flex-wrap gap-2">
        <Button size="lg" className="h-10 px-4" disabled={pending} onClick={onConfirm}>
          {pending ? "Publicando…" : isUpdate ? "Confirmar atualização" : "Publicar"}
        </Button>
        <Button variant="outline" size="lg" className="h-10 px-4" onClick={onBack}>
          Voltar
        </Button>
        <Button variant="ghost" size="lg" className="h-10 px-4" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </section>
  );
}

type Step =
  | { kind: "list" }
  | { kind: "compose"; target: ShareSummary | null }
  | { kind: "preview"; target: ShareSummary | null; preview: SharePreview };

interface ShareManagerProps {
  repertoire: Repertoire;
  songs: readonly Song[];
  catalogSongs: readonly CatalogSongView[];
  api: ShareApi;
}

function ShareManager({ repertoire, songs, catalogSongs, api }: ShareManagerProps) {
  const [shares, setShares] = useState<ShareSummary[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: "list" });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [includeMassDate, setIncludeMassDate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await api.list(repertoire.id);
      setShares(result.shares);
      setEnabled(result.enabled);
    } catch (caught) {
      setLoadError(getLibraryErrorMessage(caught));
    }
  }, [api, repertoire.id]);

  useEffect(() => {
    let active = true;
    api.list(repertoire.id).then(
      (result) => {
        if (active) {
          setShares(result.shares);
          setEnabled(result.enabled);
        }
      },
      (caught: unknown) => {
        if (active) {
          setLoadError(getLibraryErrorMessage(caught));
        }
      },
    );
    return () => {
      active = false;
    };
  }, [api, repertoire.id]);

  function startCompose(target: ShareSummary | null): void {
    setError(null);
    setSelected(new Set(target?.authorizedSongIds ?? []));
    setIncludeMassDate(target?.includeMassDate === true);
    setStep({ kind: "compose", target });
  }

  function cancel(): void {
    setError(null);
    setStep({ kind: "list" });
  }

  function toggle(songId: string, checked: boolean): void {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(songId);
      } else {
        next.delete(songId);
      }
      return next;
    });
  }

  async function requestPreview(target: ShareSummary | null): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const preview = await api.preview(repertoire.id, target?.id ?? null, toSelection(selected, includeMassDate));
      setStep({ kind: "preview", target, preview });
    } catch (caught) {
      setError(getLibraryErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function confirm(target: ShareSummary | null, preview: SharePreview): Promise<void> {
    setError(null);
    setPending(true);
    const input = { ...toSelection(selected, includeMassDate), expectedHash: preview.contentHash };

    try {
      if (target) {
        await api.update(repertoire.id, target.id, { ...input, expectedRevision: target.revision });
        showToast("Publicação atualizada. O link continua o mesmo.");
      } else {
        await api.create(repertoire.id, input);
        showToast("Link público criado.");
      }
      setStep({ kind: "list" });
      await load();
    } catch (caught) {
      setError(getLibraryErrorMessage(caught));

      if (caught instanceof LibraryError && caught.code === "share-preview-outdated") {
        setStep({ kind: "compose", target });
      } else if (caught instanceof LibraryError && caught.code === "share-conflict") {
        setStep({ kind: "list" });
        await load();
      }
    } finally {
      setPending(false);
    }
  }

  async function revoke(share: ShareSummary): Promise<void> {
    await api.revoke(repertoire.id, share.id);
    showToast("Link revogado.");
    await load();
  }

  if (loadError && !shares) {
    return (
      <div className="space-y-3">
        <FormError message={loadError} />
        <Button variant="outline" size="lg" className="h-10 px-4" onClick={() => void load()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!shares) {
    return <ContentSkeleton />;
  }

  return (
    <div className="space-y-5">
      {error && <FormError message={error} />}

      {!enabled && (
        <p className="rounded-lg border px-3 py-2.5 text-sm text-muted-foreground">
          O compartilhamento público não está ativado neste ambiente. Links já criados podem ser
          revogados. Para gerar e abrir links, o responsável pelo site precisa ativar o recurso.
        </p>
      )}

      {step.kind === "compose" && (
        <ShareCompose
          repertoire={repertoire}
          songs={songs}
          catalogSongs={catalogSongs}
          target={step.target}
          selected={selected}
          includeMassDate={includeMassDate}
          pending={pending}
          onToggle={toggle}
          onIncludeMassDate={setIncludeMassDate}
          onPreview={() => void requestPreview(step.target)}
          onCancel={cancel}
        />
      )}

      {step.kind === "preview" && (
        <SharePreviewPanel
          preview={step.preview}
          isUpdate={step.target !== null}
          pending={pending}
          onConfirm={() => void confirm(step.target, step.preview)}
          onBack={() => setStep({ kind: "compose", target: step.target })}
          onCancel={cancel}
        />
      )}

      {step.kind === "list" && (
        <>
          {enabled && (
            <Button size="lg" className="h-10 px-4" onClick={() => startCompose(null)}>
              Criar novo link
            </Button>
          )}

          {shares.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este repertório ainda não tem links públicos.</p>
          ) : (
            <ul className="space-y-3">
              {shares.map((share) => (
                <ShareCard
                  key={share.id}
                  share={share}
                  onUpdate={() => startCompose(share)}
                  onRevoke={() => revoke(share)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function AccountShareManager({ repertoire, songs, catalogSongs }: Omit<ShareManagerProps, "api">) {
  const userId = accountLibrary.getRemoteUserId();
  const api = useMemo(() => (userId ? createShareApi(userId) : null), [userId]);

  return api ? (
    <ShareManager key={userId} repertoire={repertoire} songs={songs} catalogSongs={catalogSongs} api={api} />
  ) : (
    <ContentSkeleton />
  );
}

export function ShareRepertoireScreen({ repertoireId }: { repertoireId: RepertoireId }) {
  return (
    <LibraryGate>
      {({ songs, repertoires, catalogSongs }) => {
        const repertoire = repertoires.find((candidate) => candidate.id === repertoireId);
        if (!repertoire) {
          return <RepertoireNotFound />;
        }

        return (
          <>
            <PageHeader
              title="Compartilhar repertório"
              back={{ href: `/repertorios/${repertoire.id}`, label: repertoire.name }}
              description="Cria um link que qualquer pessoa pode abrir, com uma cópia do que você autorizar."
            />
            {repertoire.items.length === 0 ? (
              <EmptyState
                icon={Info}
                title="Repertório vazio"
                description="Adicione músicas ao repertório antes de publicar."
              />
            ) : (
              <AccountShareManager repertoire={repertoire} songs={songs} catalogSongs={catalogSongs} />
            )}
          </>
        );
      }}
    </LibraryGate>
  );
}
