"use client";

import { cn } from "cn";
import { ListPlus, Plus } from "lucide-react";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";

import { OverlayPanel } from "@/components/layout/overlay-panel";
import { FormError } from "@/components/layout/form-error";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useLibrary } from "@/features/library/components/use-library";
import { repertoireRepository } from "@/features/library/data/browser-library";
import { getLibraryErrorMessage } from "@/features/library/domain/library-errors";
import { pickCurrentRepertoire } from "@/features/repertoires/components/repertoire-builder";
import { hasSongInRepertoire } from "@/features/repertoires/services/repertoire-items";
import type { MusicalKey } from "@/features/songs/domain/musical-key";
import type { CatalogContentType, SongSource } from "@/features/songs/domain/song";
import { LITURGICAL_MOMENTS, type LiturgicalMomentId } from "@/features/liturgy/domain/vocabulary";
import {
  formatSemitoneOffset,
  MAX_TRANSPOSE_SEMITONES,
  MIN_TRANSPOSE_SEMITONES,
  transposeKey,
} from "@/features/songs/domain/transposition";
import { showToast } from "@/lib/utils/toast";

interface AddToRepertoireProps {
  songId: string;
  title: string;
  /** Ausente quando o tom original não é conhecido: não há tom a escolher. */
  originalKey?: MusicalKey;
  contentType: CatalogContentType;
  /** Momentos da classificação, oferecidos primeiro na escolha do momento. */
  suggestedMoments?: readonly LiturgicalMomentId[];
  /**
   * No catálogo em três zonas, o repertório atual do painel da direita já vem escolhido
   * (o do endereço, ou o alterado mais recentemente). Fora dele, a escolha é sempre explícita.
   */
  preferCurrent?: { repertoireId: string | null };
  /** Botão principal (cheio), como na referência do leitor. */
  primary?: boolean;
  /** Painel flutuante sob o botão, sem empurrar a barra de controles da cifra. */
  popover?: boolean;
  iconOnly?: boolean;
  source?: SongSource;
}

const OFFSETS = Array.from(
  { length: MAX_TRANSPOSE_SEMITONES - MIN_TRANSPOSE_SEMITONES + 1 },
  (_, index) => index + MIN_TRANSPOSE_SEMITONES,
);

/**
 * Adiciona a música do catálogo a um repertório do usuário. Só a referência é gravada:
 * a cifra continua no catálogo. Sem sessão, explica e oferece entrar.
 */
export function AddToRepertoire({
  songId,
  title,
  originalKey,
  contentType,
  suggestedMoments = [],
  preferCurrent,
  primary = false,
  popover = false,
  iconOnly = false,
  source = "catalog",
}: AddToRepertoireProps) {
  const [open, setOpen] = useState(false);

  return <OverlayPanel open={open} onOpenChange={setOpen} title="Adicionar ao repertório" description={title}
    trigger={<Button variant={primary ? "default" : "outline"} size={iconOnly ? "icon" : "lg"}
      className={cn(popover && !iconOnly && "px-3")} aria-label={iconOnly ? `Adicionar ${title} ao repertório` : "Adicionar ao repertório"}>
      {iconOnly ? <Plus aria-hidden /> : <><ListPlus data-icon="inline-start" aria-hidden />Adicionar</>}
    </Button>}>
    {open && <AddToRepertoirePanel songId={songId} title={title} originalKey={originalKey} contentType={contentType}
      suggestedMoments={suggestedMoments} preferCurrent={preferCurrent} source={source} onDone={() => setOpen(false)} />}
  </OverlayPanel>;
}

function AddToRepertoirePanel({
  songId,
  title,
  originalKey,
  contentType,
  suggestedMoments = [],
  preferCurrent,
  onDone,
  source = "catalog",
}: AddToRepertoireProps & { onDone: () => void }) {
  const snapshot = useLibrary();
  const [repertoireId, setRepertoireId] = useState(() =>
    preferCurrent && snapshot.status === "ready"
      ? (pickCurrentRepertoire(snapshot.library, preferCurrent.repertoireId)?.id ?? "")
      : "",
  );
  const [semitones, setSemitones] = useState(0);
  const [moment, setMoment] = useState<LiturgicalMomentId | "">("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fieldId = useId();

  if (snapshot.status === "loading") {
    return <p className="text-sm text-muted-foreground">Verificando sua conta…</p>;
  }

  if (snapshot.status !== "ready") {
    // Nada é guardado no navegador como se tivesse sido salvo.
    return (
      <div className="space-y-3 text-sm">
        <p>Para montar repertórios, entre na sua conta. Os repertórios ficam salvos nela.</p>
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

  const { repertoires } = snapshot.library;
  if (repertoires.length === 0) {
    return (
      <p className="text-sm">
        Você ainda não tem repertórios.{" "}
        <Link href="/repertorios/novo" className="font-medium underline underline-offset-3">
          Criar repertório
        </Link>
      </p>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    const repertoire = repertoires.find((candidate) => candidate.id === repertoireId);
    if (!repertoire) {
      setError("Escolha um repertório.");
      return;
    }
    if (hasSongInRepertoire(repertoire.items, source, songId)) {
      setError("Esta música já está neste repertório.");
      return;
    }

    setPending(true);
    try {
      const updated = await repertoireRepository.addSong(
        repertoire.id,
        songId,
        repertoire.revision,
        source,
        moment || undefined,
      );
      const added = updated.items.find((item) => item.source === source && item.songId === songId);
      if (added && semitones !== 0) {
        // O tom fica no item deste repertório; a música do catálogo não muda.
        await repertoireRepository.updateItem(repertoire.id, added.id, { transposeSemitones: semitones }, updated.revision);
      }
      showToast(`“${title}” adicionada a ${repertoire.name}.`);
      onDone();
    } catch (caught) {
      setError(getLibraryErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <div className="space-y-1">
        <label htmlFor={`${fieldId}-rep`} className="block text-sm font-medium">
          Repertório
        </label>
        <NativeSelect
          id={`${fieldId}-rep`}
          value={repertoireId}
          onChange={(event) => setRepertoireId(event.target.value)}
          className="w-full"
        >
          <NativeSelectOption value="">Selecione um repertório</NativeSelectOption>
          {repertoires.map((repertoire) => (
            <NativeSelectOption key={repertoire.id} value={repertoire.id}>
              {repertoire.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${fieldId}-momento`} className="block text-sm font-medium">
          Momento da missa (opcional)
        </label>
        <NativeSelect
          id={`${fieldId}-momento`}
          value={moment}
          onChange={(event) => setMoment(event.target.value as LiturgicalMomentId | "")}
          className="w-full"
        >
          <NativeSelectOption value="">Sem momento definido</NativeSelectOption>
          {[...LITURGICAL_MOMENTS]
            .sort((a, b) => Number(suggestedMoments.includes(b.id)) - Number(suggestedMoments.includes(a.id)))
            .map((entry) => (
              <NativeSelectOption key={entry.id} value={entry.id}>
                {entry.label}
                {suggestedMoments.includes(entry.id) ? " (indicado na classificação)" : ""}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </div>
      {contentType !== "external-link" && originalKey && (
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-tom`} className="block text-sm font-medium">
            Tom neste repertório
          </label>
          <NativeSelect
            id={`${fieldId}-tom`}
            value={String(semitones)}
            onChange={(event) => setSemitones(Number(event.target.value))}
            className="w-full"
          >
            {OFFSETS.map((offset) => (
              <NativeSelectOption key={offset} value={String(offset)}>
                {transposeKey(originalKey as MusicalKey, offset)}
                {offset === 0 ? " (original)" : ` (${formatSemitoneOffset(offset)})`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}
      {error && <FormError message={error} />}
      <Button type="submit" size="lg" className="h-10 px-4" disabled={pending}>
        {pending ? "Adicionando…" : "Adicionar"}
      </Button>
    </form>
  );
}
