"use client";

import { cn } from "cn";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ListMusic,
  LoaderCircle,
  Minus,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { OverlayPanel } from "@/components/layout/overlay-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLibrary } from "@/features/library/components/use-library";
import { repertoireRepository } from "@/features/library/data/browser-library";
import type { Library } from "@/features/library/domain/library";
import { getLibraryErrorMessage } from "@/features/library/domain/library-errors";
import { momentLabel } from "@/features/liturgy/domain/vocabulary";
import { KeyLabel } from "@/features/songs/components/key-label";
import { transposableKey } from "@/features/songs/domain/song";
import { MAX_TRANSPOSE_SEMITONES, MIN_TRANSPOSE_SEMITONES, transposeKey } from "@/features/songs/domain/transposition";
import { showToast } from "@/lib/utils/toast";
import { useKeyboardOpen } from "@/lib/utils/use-keyboard-open";

import type { Repertoire } from "../domain/repertoire";
import { getRepertoireSongHref } from "../services/repertoire-reading-context";
import { buildRepertoireEntries, type RepertoireEntry } from "../services/repertoire-service";
import type { MoveDirection } from "../services/repertoire-items";
import { saveSemitones, useItemSemitones } from "./save-item-semitones";

export type LibraryStatus = ReturnType<typeof useLibrary>["status"];

/** Repertório atual: o escolhido, ou o alterado mais recentemente. */
export function pickCurrentRepertoire(library: Library | null, preferredId: string | null | undefined): Repertoire | null {
  if (!library) {
    return null;
  }
  const preferred = preferredId ? library.repertoires.find((repertoire) => repertoire.id === preferredId) : undefined;
  if (preferred) {
    return preferred;
  }
  return [...library.repertoires].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

interface RepertoireBuilderProps {
  /** Nome acessível da região; a preparação da missa usa "Repertório desta missa". */
  label: string;
  title: string;
  /** Linha sob o título: a celebração e a data, ou o nome do repertório. */
  subtitle?: string;
  /** Resumo da barra recolhida quando nenhum repertório está escolhido. */
  emptySummary?: string;
  status: LibraryStatus;
  library: Library | null;
  repertoire: Repertoire | null;
  /** Fechado só abaixo de 1280px; no computador o painel fica sempre aberto ao lado. */
  open: boolean;
  onToggle: () => void;
  hint?: string | null;
  /** Escolha ou criação de repertório, quando nenhum está selecionado. */
  chooser: ReactNode;
  emptyText: string;
  onChangeRepertoire: () => void;
  /** Ação "Adicionar música": leva aonde se escolhem músicas. */
  addMore?: { href: string } | { onClick: () => void };
  /** Conteúdo complementar sob o painel (dicas), só no computador. */
  aside?: ReactNode;
  className?: string;
  finalFocus?: () => HTMLElement | boolean | null;
}

/**
 * Repertório em construção, como nas referências: faixa oliva com o título, itens numerados com
 * momento, tom e ações, e os atalhos para ver o repertório completo. Tudo que aparece já está
 * salvo na conta; cada ação usa a revisão carregada.
 */
export function RepertoireBuilder({
  label,
  title,
  subtitle,
  emptySummary = "Montar o repertório",
  status,
  library,
  repertoire,
  open,
  onToggle,
  hint,
  chooser,
  emptyText,
  onChangeRepertoire,
  addMore,
  aside,
  className,
  finalFocus,
}: RepertoireBuilderProps) {
  const count = repertoire?.items.length ?? 0;
  const keyboardOpen = useKeyboardOpen();
  const summary = repertoire
    ? `${repertoire.name} · ${count === 1 ? "1 música" : `${count} músicas`}`
    : status === "signed-out"
      ? "Entre para montar um repertório"
      : emptySummary;
  return (
    <section aria-label={label} className={cn("repertoire-dock", className)} style={{ display:keyboardOpen && !open ? "none" : undefined }} data-print-hide>
      <OverlayPanel keepMounted open={open} finalFocus={finalFocus} onOpenChange={next => { if(next !== open) onToggle(); }} title={title} description={subtitle ?? repertoire?.name}
        trigger={<button type="button" className="repertoire-dock-trigger" aria-label={`Abrir ${label.toLowerCase()}, ${summary}`}>
          <ListMusic className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 text-left"><strong className="block text-sm">Repertório ativo</strong><span className="block truncate text-xs text-muted-foreground">{summary}</span></span>
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-primary">{count}</span>
          <ChevronDown className="size-5 shrink-0" aria-hidden />
        </button>}>
        <div className="space-y-4" role="region" aria-label={label + " aberto"}>
          {hint && <p role="status" className="text-sm font-medium">{hint}</p>}
          {status === "loading" && <p className="text-sm text-muted-foreground">Verificando sua conta…</p>}
          {status === "signed-out" && <SignInInvite />}
          {status === "remote-error" && <p className="text-sm">Sua biblioteca está indisponível no momento. Nada foi alterado.</p>}
          {library && !repertoire && chooser}
          {library && repertoire && <BuildingList library={library} repertoire={repertoire} emptyText={emptyText} addMore={addMore} onChange={onChangeRepertoire} />}
          {aside}
        </div>
      </OverlayPanel>
    </section>
  );
}

function SignInInvite() {
  return (
    <div className="space-y-3 text-sm">
      <p>
        Para montar e salvar um repertório, entre na sua conta. Consultar as sugestões e as cifras não exige login.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/entrar" className={cn(buttonVariants({ size: "lg" }))}>
          Entrar
        </Link>
        <Link href="/cadastro" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Criar conta
        </Link>
      </div>
    </div>
  );
}

interface BuildingListProps {
  library: Library;
  repertoire: Repertoire;
  emptyText: string;
  addMore?: RepertoireBuilderProps["addMore"];
  onChange: () => void;
}

function BuildingList({ library, repertoire, emptyText, addMore, onChange }: BuildingListProps) {
  const entries = buildRepertoireEntries(repertoire.items, library.songs, library.catalogSongs);
  const [busy, setBusy] = useState(false);

  async function act(action: () => Promise<unknown>, success?: string): Promise<void> {
    setBusy(true);
    try {
      await action();
      if (success) {
        showToast(success);
      }
    } catch (error) {
      showToast(getLibraryErrorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }

  const move = (entry: RepertoireEntry, direction: MoveDirection) =>
    act(() => repertoireRepository.moveItem(repertoire.id, entry.item.id, direction, repertoire.revision));
  const remove = (entry: RepertoireEntry) =>
    act(
      () => repertoireRepository.removeItem(repertoire.id, entry.item.id, repertoire.revision),
      `“${entry.song?.title ?? "Música"}” removida do repertório.`,
    );

  const outline = cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 w-full justify-center gap-2 font-display text-base");

  return (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ol className="divide-y">
          {entries.map((entry, index) => (
            <BuildingItem
              key={entry.item.id}
              repertoire={repertoire}
              entry={entry}
              number={index + 1}
              first={index === 0}
              last={index === entries.length - 1}
              busy={busy}
              onMove={(direction) => void move(entry, direction)}
              onRemove={() => void remove(entry)}
            />
          ))}
        </ol>
      )}
      {addMore &&
        ("href" in addMore ? (
          <Link href={addMore.href} className={outline}>
            <Plus className="size-4" aria-hidden />
            Adicionar música
          </Link>
        ) : (
          <button type="button" className={outline} onClick={addMore.onClick}>
            <Plus className="size-4" aria-hidden />
            Adicionar música
          </button>
        ))}
      <Link
        href={`/repertorios/${repertoire.id}`}
        className={cn(buttonVariants({ size: "lg" }), "h-11 w-full justify-between px-4 font-display text-base")}
      >
        <span className="flex items-center gap-2">
          <BookOpen className="size-4" aria-hidden />
          Ver repertório completo
        </span>
        <ArrowRight className="size-4" aria-hidden />
      </Link>
      {/* Informações secundárias numa linha só: o estado do salvamento e a troca de repertório. */}
      <div className="flex items-center justify-between gap-2 pt-0.5 text-xs">
        <p role="status" className="flex items-center gap-1.5 text-muted-foreground">
          {busy ? (
            <>
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              Salvando…
            </>
          ) : (
            <>
              <Check className="size-3.5 text-primary" aria-hidden />
              Salvo na sua conta
            </>
          )}
        </p>
        <span className="flex items-center gap-1">
          {/* Impressão do repertório atual, já salvo na conta: pré-visualização com o formato. */}
          {entries.length > 0 && (
            <Link
              href={`/repertorios/${repertoire.id}/imprimir`}
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs underline-offset-3 hover:underline"
            >
              <Printer className="size-3.5" aria-hidden />
              Imprimir
            </Link>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs underline-offset-3 hover:underline" onClick={onChange}>
            Trocar de repertório
          </Button>
        </span>
      </div>
    </div>
  );
}

interface BuildingItemProps {
  repertoire: Repertoire;
  entry: RepertoireEntry;
  number: number;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (direction: MoveDirection) => void;
  onRemove: () => void;
}

function BuildingItem({ repertoire, entry, number, first, last, busy, onMove, onRemove }: BuildingItemProps) {
  const { item, song } = entry;
  const semitones = useItemSemitones({ repertoireId: repertoire.id, itemId: item.id }, item.transposeSemitones);
  const title = song?.title ?? "Música indisponível";
  const key = song ? transposableKey(song) : null;
  const iconButton = "size-11 text-muted-foreground hover:text-foreground";

  function change(delta: number): void {
    void saveSemitones(repertoire.id, item.id, semitones + delta, repertoire.revision);
  }

  return (
    <li className="flex items-start gap-2.5 py-2.5">
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-alt font-display text-sm font-semibold text-heading"
      >
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base leading-snug font-semibold wrap-break-word text-heading">
          <span className="sr-only">{number}. </span>
          {song ? <Link className="inline-flex min-h-11 items-center hover:underline" href={getRepertoireSongHref(repertoire.id, item)}>{title}</Link> : title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {item.moment && <p className="text-xs text-muted-foreground">{momentLabel(item.moment)}</p>}
          <div className="ml-auto flex max-w-full flex-wrap items-center gap-1">
            {key && (
              <div role="group" aria-label={`Tom de ${title}`} className="flex items-center rounded-full border bg-background/60">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="size-11 rounded-full"
                  aria-label={`Diminuir um semitom de ${title}`}
                  disabled={semitones <= MIN_TRANSPOSE_SEMITONES}
                  onClick={() => change(-1)}
                >
                  <Minus aria-hidden />
                </Button>
                <span role="status" className="min-w-7 text-center text-sm font-medium">
                  <KeyLabel musicalKey={transposeKey(key, semitones)} />
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="size-11 rounded-full"
                  aria-label={`Aumentar um semitom de ${title}`}
                  disabled={semitones >= MAX_TRANSPOSE_SEMITONES}
                  onClick={() => change(1)}
                >
                  <Plus aria-hidden />
                </Button>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className={iconButton}
              aria-label={`Subir ${title}`}
              disabled={first || busy}
              onClick={() => onMove("up")}
            >
              <ArrowUp className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className={iconButton}
              aria-label={`Descer ${title}`}
              disabled={last || busy}
              onClick={() => onMove("down")}
            >
              <ArrowDown className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className={iconButton}
              aria-label={`Remover ${title} do repertório`}
              disabled={busy}
              onClick={onRemove}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
