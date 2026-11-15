"use client";

import { cn } from "cn";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  ListMusic,
  LoaderCircle,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

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

import type { Repertoire } from "../domain/repertoire";
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
}: RepertoireBuilderProps) {
  const count = repertoire?.items.length ?? 0;
  const summary = repertoire
    ? `${repertoire.name} · ${count === 1 ? "1 música" : `${count} músicas`}`
    : status === "signed-out"
      ? "Entre para montar um repertório"
      : emptySummary;
  const bodyId = `${label.replace(/\W+/g, "-").toLowerCase()}-conteudo`;

  return (
    <div
      className={cn(
        "fixed inset-x-3 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-20 md:inset-x-auto md:right-4 md:bottom-4 md:w-[25rem]",
        "[@media(max-height:520px)]:bottom-[calc(3.6rem+env(safe-area-inset-bottom))] md:[@media(max-height:520px)]:bottom-3",
        "xl:sticky xl:top-[5.6rem] xl:right-auto xl:bottom-auto xl:z-auto xl:w-auto xl:self-start",
        className,
      )}
    >
      <section
        aria-label={label}
        className="flex max-h-[calc(100dvh-9rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-xl xl:max-h-[calc(100dvh-6.6rem)] xl:shadow-sm"
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex w-full items-center gap-3 bg-header px-4 py-2.5 text-left text-header-foreground xl:hidden [@media(max-height:520px)]:py-1.5"
        >
          <ListMusic className="size-5 shrink-0 text-header-accent" aria-hidden />
          {/* Uma linha só na barra recolhida: o tipo e o resumo lado a lado. */}
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="shrink-0 text-xs text-header-muted">{repertoire ? title : "Repertório"}</span>
            <span className="truncate font-medium">{summary}</span>
          </span>
          {open ? <ChevronDown className="size-5 shrink-0" aria-hidden /> : <ChevronUp className="size-5 shrink-0" aria-hidden />}
        </button>

        <div aria-hidden className="hidden items-center gap-3 bg-header px-5 py-3.5 text-header-foreground xl:flex">
          <ListMusic className="size-9 shrink-0 stroke-[1.4] text-header-accent" />
          <div className="min-w-0">
            <p className="font-display text-[1.45rem] leading-tight font-semibold">{title}</p>
            <p className="truncate text-sm text-header-muted">{subtitle ?? (repertoire ? repertoire.name : "Nenhum repertório escolhido")}</p>
          </div>
        </div>

        <div id={bodyId} className={cn("min-h-0 flex-1 flex-col overflow-y-auto", open ? "flex" : "hidden", "xl:flex")}>
          <div className="space-y-3 px-3 py-3 xl:px-4">
            {hint && (
              <p role="status" className="text-sm font-medium">
                {hint}
              </p>
            )}
            {status === "loading" && <p className="text-sm text-muted-foreground">Verificando sua conta…</p>}
            {status === "signed-out" && <SignInInvite />}
            {status === "remote-error" && (
              <p className="text-sm">Sua biblioteca está indisponível no momento. Nada foi alterado.</p>
            )}
            {library && !repertoire && chooser}
            {library && repertoire && (
              <BuildingList
                library={library}
                repertoire={repertoire}
                emptyText={emptyText}
                addMore={addMore}
                onChange={onChangeRepertoire}
              />
            )}
          </div>
        </div>
      </section>
      {aside && <div className="mt-3 hidden xl:block">{aside}</div>}
    </div>
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
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs underline-offset-3 hover:underline" onClick={onChange}>
          Trocar de repertório
        </Button>
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
  const iconButton = "size-8 text-muted-foreground hover:text-foreground";

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
        <p className="font-display text-[0.98rem] leading-snug font-semibold wrap-break-word text-heading">
          <span className="sr-only">{number}. </span>
          {title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {item.moment && <p className="text-xs text-muted-foreground">{momentLabel(item.moment)}</p>}
          <div className="ml-auto flex items-center gap-1">
            {key && (
              <div role="group" aria-label={`Tom de ${title}`} className="flex items-center rounded-full border bg-background/60">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="size-8 rounded-full"
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
                  className="size-8 rounded-full"
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
