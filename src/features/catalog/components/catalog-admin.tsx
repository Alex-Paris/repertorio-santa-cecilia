"use client";

import { cn } from "cn";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { FormError } from "@/components/layout/form-error";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { getLibraryErrorMessage, LibraryError } from "@/features/library/domain/library-errors";
import { ChordProEditor } from "@/features/songs/components/chordpro-editor";
import { MUSICAL_KEYS, type MusicalKey } from "@/features/songs/domain/musical-key";
import { CONTENT_TYPE_LABELS } from "@/features/songs/domain/song";
import { showToast } from "@/lib/utils/toast";

import { createCatalogAdminApi } from "../data/catalog-admin-api";
import { CatalogClassificationEditor, CatalogReviewPanel } from "./catalog-classification-editor";
import {
  CATALOG_STATUSES,
  RIGHTS_BASES,
  publicationProblems,
  RIGHTS_BASIS_LABELS,
  type CatalogSong,
  type CatalogSongInput,
  type CatalogStatus,
  type RightsBasis,
} from "../domain/catalog-song";

const STATUS_LABELS: Record<CatalogStatus, string> = {
  draft: "Rascunho",
  published: "Publicada",
  unpublished: "Despublicada",
};

const STATUS_TONES: Record<CatalogStatus, string> = {
  draft: "border-warning/25 bg-warning/8 text-warning",
  published: "border-success/25 bg-success/8 text-success",
  unpublished: "border-border bg-muted text-muted-foreground",
};

const CONFLICT_MESSAGE =
  "Esta música foi alterada por outra pessoa da administração. Recarregue a página antes de continuar.";

function messageOf(error: unknown): string {
  return error instanceof LibraryError && error.code === "revision-conflict"
    ? CONFLICT_MESSAGE
    : getLibraryErrorMessage(error);
}

/** Lista completa, inclusive rascunhos: só chega aqui quem o servidor reconheceu como admin. */
export function CatalogAdminList({ userId }: { userId: string }) {
  const api = useMemo(() => createCatalogAdminApi(userId), [userId]);
  const [status, setStatus] = useState<CatalogStatus | "">("");
  const [songs, setSongs] = useState<CatalogSong[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.list(status || undefined).then(
      (result) => active && setSongs(result),
      (caught: unknown) => active && setError(messageOf(caught)),
    );
    return () => {
      active = false;
    };
  }, [api, status]);

  return (
    <div className="space-y-4">
      <div className="surface-panel flex flex-wrap items-end justify-between gap-4 p-4 sm:p-5">
        <div className="space-y-1">
          <label htmlFor="admin-status" className="block text-sm font-medium">
            Situação
          </label>
          <NativeSelect id="admin-status" value={status} onChange={(event) => setStatus(event.target.value as CatalogStatus | "")}>
            <NativeSelectOption value="">Todas</NativeSelectOption>
            {CATALOG_STATUSES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {STATUS_LABELS[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Link href="/admin/catalogo/nova" className={cn(buttonVariants({ size: "lg" }))}>
          <Plus data-icon="inline-start" aria-hidden />
          Nova música
        </Link>
      </div>
      {error && <FormError message={error} />}
      {!songs && !error && <ContentSkeleton />}
      {songs && <p role="status" className="text-sm text-muted-foreground">{songs.length === 1 ? "1 música" : `${songs.length} músicas`}</p>}
      {songs && songs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma música nesta situação.</p>}
      {songs && songs.length > 0 && (
        <ul className="surface-panel divide-y">
          {songs.map((song) => (
            <li key={song.id}>
              <Link href={`/admin/catalogo/${song.id}`} className="flex min-h-20 items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{song.title}</span>
                  <span className="block truncate text-sm text-muted-foreground">{song.artist}</span>
                </span>
                <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium", STATUS_TONES[song.status])}>{STATUS_LABELS[song.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ContentChoice = "hosted" | "external-link" | "metadata-only";

interface SourceDraft {
  title: string;
  url: string;
  accessedAt: string;
}

interface FormState {
  title: string;
  artist: string;
  compositionReference: string;
  metadataSources: SourceDraft[];
  content: ContentChoice;
  hostedType: "original" | "authorized";
  originalKey: MusicalKey | "";
  chordPro: string;
  sourceUrl: string;
  basis: RightsBasis;
  evidence: string;
  displayChordPro: boolean;
  shareChordPro: boolean;
  linkExternalSource: boolean;
}

const EMPTY: FormState = {
  title: "",
  artist: "",
  compositionReference: "",
  metadataSources: [],
  content: "metadata-only",
  hostedType: "original",
  originalKey: "",
  chordPro: "",
  sourceUrl: "",
  basis: "public-metadata",
  evidence: "",
  displayChordPro: false,
  shareChordPro: false,
  linkExternalSource: true,
};

function toFormState(song: CatalogSong): FormState {
  const content: ContentChoice =
    song.contentType === "external-link" ? "external-link" : song.contentType === "metadata-only" ? "metadata-only" : "hosted";
  return {
    title: song.title,
    artist: song.artist,
    compositionReference: song.compositionReference ?? "",
    metadataSources: song.metadataSources.map((source) => ({
      title: source.title,
      url: source.url ?? "",
      accessedAt: source.accessedAt ?? "",
    })),
    content,
    hostedType: song.contentType === "authorized" ? "authorized" : "original",
    originalKey: song.originalKey ?? "",
    chordPro: song.contentType === "original" || song.contentType === "authorized" ? (song.chordPro ?? "") : "",
    sourceUrl: song.contentType === "external-link" ? song.sourceUrl : "",
    basis: song.rights.basis,
    evidence: song.rights.evidence,
    displayChordPro: song.rights.displayChordPro,
    shareChordPro: song.rights.shareChordPro,
    linkExternalSource: song.rights.linkExternalSource,
  };
}

/** Só o que o tipo de conteúdo usa vai ao servidor; campos vazios ficam pendentes, sem valor suposto. */
function toInput(state: FormState): CatalogSongInput {
  const key = state.originalKey || undefined;
  const common = { title: state.title, artist: state.artist };
  const song: CatalogSongInput["song"] =
    state.content === "external-link"
      ? { ...common, originalKey: key as MusicalKey, contentType: "external-link", sourceUrl: state.sourceUrl }
      : state.content === "metadata-only"
        ? { ...common, contentType: "metadata-only", ...(key ? { originalKey: key } : {}) }
        : {
            ...common,
            originalKey: key as MusicalKey,
            contentType: state.hostedType,
            ...(state.chordPro.trim() ? { chordPro: state.chordPro } : {}),
          };
  return {
    song,
    ...(state.compositionReference.trim() ? { compositionReference: state.compositionReference.trim() } : {}),
    metadataSources: state.metadataSources
      .filter((source) => source.title.trim())
      .map((source) => ({
        title: source.title.trim(),
        ...(source.url.trim() ? { url: source.url.trim() } : {}),
        ...(source.accessedAt ? { accessedAt: source.accessedAt } : {}),
      })),
    rights: {
      basis: state.basis,
      evidence: state.evidence,
      displayChordPro: state.content === "hosted" && state.displayChordPro,
      shareChordPro: state.content === "hosted" && state.shareChordPro,
      linkExternalSource: state.content === "external-link" && state.linkExternalSource,
    },
  };
}

const CONTENT_CHOICES: { value: ContentChoice; label: string; hint: string }[] = [
  { value: "metadata-only", label: "Somente metadados", hint: "Música conhecida, sem cifra nem link autorizados. O público vê “Cifra ainda não disponível”." },
  { value: "external-link", label: "Link para cifra externa", hint: "Aponta para a fonte original. O público vê “Consultar cifra na fonte original”, se o link for permitido." },
  { value: "hosted", label: "Cifra própria ou autorizada", hint: "A cifra fica no catálogo. Exibir e redistribuir dependem dos direitos abaixo." },
];

const STEPS = [
  { id: "identificacao", label: "A. Identificação" },
  { id: "conteudo", label: "B. Conteúdo" },
  { id: "classificacao", label: "C. Classificação litúrgica" },
  { id: "revisao", label: "D. Direitos e revisão" },
] as const;

function Steps({ available }: { available: boolean }) {
  return (
    <nav aria-label="Etapas do cadastro" className="sticky top-14 z-10 -mx-4 overflow-x-auto border-b bg-background/95 px-4 py-2 backdrop-blur md:top-16 md:mx-0 md:px-0">
      <ol className="flex gap-2 text-sm">
        {STEPS.map((step, index) => (
          <li key={step.id}>
            {available || index < 2 ? (
              <a href={`#${step.id}`} className="inline-flex h-9 items-center rounded-full border bg-card px-3 whitespace-nowrap hover:bg-muted">
                {step.label}
              </a>
            ) : (
              <span className="inline-flex h-9 items-center rounded-full border border-dashed px-3 whitespace-nowrap text-muted-foreground">
                {step.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function SectionTitle({ id, children, hint }: { id: string; children: string; hint?: string }) {
  return (
    <div id={id} className="scroll-mt-32">
      <h2 className="font-display text-xl font-semibold tracking-tight">{children}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Cadastro em etapas. Um rascunho pode ser salvo só com o título; o resto fica pendente e o
 * relatório de qualidade mostra o que falta. Toda gravação leva a revisão carregada.
 */
export function CatalogSongEditor({ userId, songId }: { userId: string; songId?: string }) {
  const router = useRouter();
  const api = useMemo(() => createCatalogAdminApi(userId), [userId]);
  const [song, setSong] = useState<CatalogSong | null>(null);
  const [state, setState] = useState<FormState | null>(songId ? null : EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!songId) {
      return;
    }
    let active = true;
    api.get(songId).then(
      (loaded) => {
        if (active) {
          setSong(loaded);
          setState(toFormState(loaded));
        }
      },
      (caught: unknown) => active && setError(messageOf(caught)),
    );
    return () => {
      active = false;
    };
  }, [api, songId]);

  if (!state) {
    return error ? <FormError message={error} /> : <ContentSkeleton />;
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((current) => (current ? { ...current, [key]: value } : current));
  const keyLocked = Boolean(song?.publishedAt && song.originalKey);
  const problems = song ? publicationProblems(song) : [];

  async function run(action: () => Promise<CatalogSong>, success: string): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const saved = await action();
      setSong(saved);
      setState(toFormState(saved));
      showToast(success);
      if (!songId) {
        router.replace(`/admin/catalogo/${saved.id}`);
      }
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    // Cifra e link precisam do tom real; nada é preenchido por suposição.
    if ((state as FormState).content !== "metadata-only" && !(state as FormState).originalKey) {
      setError("Escolha o tom original. Se a fonte não informa o tom, use “Somente metadados”.");
      return;
    }
    const input = toInput(state as FormState);
    void run(
      () => (song ? api.update(song.id, input, song.revision) : api.create(input)),
      song ? "Alterações salvas." : "Rascunho criado. Continue nas próximas etapas quando quiser.",
    );
  }

  const updateSource = (index: number, next: Partial<SourceDraft>) =>
    set(
      "metadataSources",
      state.metadataSources.map((source, position) => (position === index ? { ...source, ...next } : source)),
    );

  return (
    <div className="max-w-4xl space-y-6">
      <Steps available={song !== null} />

      {song && (
        <p className="rounded-lg border px-3 py-2 text-sm">
          Situação: <strong>{STATUS_LABELS[song.status]}</strong> · revisão {song.revision}
          {song.publishedAt && ` · publicada pela primeira vez em ${new Date(song.publishedAt).toLocaleDateString("pt-BR")}`}
          {song.importKey && (
            <>
              <br />
              Importada pela chave editorial “{song.importKey}”.
            </>
          )}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate aria-label="Dados da música" className="admin-editor">
        <section className="space-y-4">
          <SectionTitle id="identificacao" hint="Só o título é obrigatório para criar o rascunho. O que a fonte não confirma fica em branco.">
            A. Identificação
          </SectionTitle>
          <label className="block space-y-1 text-sm font-medium">
            Título
            <Input value={state.title} onChange={(event) => set("title", event.target.value)} className="h-10" />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Artista ou compositor
            <Input value={state.artist} onChange={(event) => set("artist", event.target.value)} className="h-10" />
            <span className="block text-xs font-normal text-muted-foreground">
              Deixe em branco se a fonte não confirmar a autoria (só em músicas com metadados).
            </span>
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Referência da composição
            <Input
              value={state.compositionReference}
              onChange={(event) => set("compositionReference", event.target.value)}
              placeholder="Ex.: Hinário Litúrgico da CNBB – Ciclo da Páscoa – Vol. II, pág. 284"
              className="h-10"
            />
          </label>
          <fieldset className="space-y-3 rounded-xl border p-4">
            <legend className="px-1 text-sm font-medium">Fontes consultadas</legend>
            {state.metadataSources.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma fonte registrada ainda.</p>
            )}
            {state.metadataSources.map((source, index) => (
              <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">
                  Fonte {index + 1}
                  <Input value={source.title} onChange={(event) => updateSource(index, { title: event.target.value })} className="h-10" />
                </label>
                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  Endereço (opcional)
                  <Input type="url" value={source.url} onChange={(event) => updateSource(index, { url: event.target.value })} className="h-10" />
                </label>
                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  Consultada em
                  <Input type="date" value={source.accessedAt} onChange={(event) => updateSource(index, { accessedAt: event.target.value })} className="h-10" />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="h-9 justify-self-start px-2"
                  onClick={() => set("metadataSources", state.metadataSources.filter((_, position) => position !== index))}
                >
                  Remover a fonte {index + 1}
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-10 px-3"
              onClick={() => set("metadataSources", [...state.metadataSources, { title: "", url: "", accessedAt: "" }])}
            >
              <Plus data-icon="inline-start" aria-hidden />
              Adicionar fonte consultada
            </Button>
          </fieldset>
        </section>

        <section className="space-y-4">
          <SectionTitle id="conteudo" hint="Nenhum conteúdo é copiado de outros sites: sem autorização, registre só os metadados.">
            B. Conteúdo
          </SectionTitle>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">O que o catálogo terá desta música</legend>
            {CONTENT_CHOICES.map((choice) => (
              <label key={choice.value} className="flex items-start gap-3 rounded-xl border p-3 text-sm has-[:checked]:border-primary">
                <input
                  type="radio"
                  name="conteudo"
                  className="mt-0.5 size-4"
                  checked={state.content === choice.value}
                  onChange={() => set("content", choice.value)}
                />
                <span>
                  <span className="block font-medium">{choice.label}</span>
                  <span className="block text-muted-foreground">{choice.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="block space-y-1 text-sm font-medium">
            Tom original
            <NativeSelect
              value={state.originalKey}
              disabled={keyLocked}
              onChange={(event) => set("originalKey", event.target.value as MusicalKey | "")}
              className="w-full"
            >
              {state.content === "metadata-only" && <NativeSelectOption value="">Não informado</NativeSelectOption>}
              {state.content !== "metadata-only" && state.originalKey === "" && <NativeSelectOption value="">Escolha o tom</NativeSelectOption>}
              {MUSICAL_KEYS.map((key) => (
                <NativeSelectOption key={key} value={key}>
                  {key}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {keyLocked && (
              <span className="block text-xs font-normal text-muted-foreground">
                Já publicada: mudar o tom alteraria os tons escolhidos nos repertórios.
              </span>
            )}
          </label>

          {state.content === "hosted" && (
            <>
              <label className="block space-y-1 text-sm font-medium">
                Tipo
                <NativeSelect
                  value={state.hostedType}
                  onChange={(event) => set("hostedType", event.target.value as "original" | "authorized")}
                  className="w-full"
                >
                  <NativeSelectOption value="original">{CONTENT_TYPE_LABELS.original}</NativeSelectOption>
                  <NativeSelectOption value="authorized">{CONTENT_TYPE_LABELS.authorized}</NativeSelectOption>
                </NativeSelect>
              </label>
              <ChordProEditor id="catalog-chordpro" value={state.chordPro} onChange={(value) => set("chordPro", value)} />
            </>
          )}
          {state.content === "external-link" && (
            <label className="block space-y-1 text-sm font-medium">
              Link da fonte original
              <Input type="url" value={state.sourceUrl} onChange={(event) => set("sourceUrl", event.target.value)} className="h-10" />
            </label>
          )}
        </section>

        <fieldset id="direitos" className="scroll-mt-32 space-y-3 rounded-xl border p-4">
          <legend className="px-1 text-sm font-medium">Direitos (parte da etapa D)</legend>
          <p className="text-xs text-muted-foreground">
            Cada permissão é separada. Os metadados aparecem com a publicação; nenhuma permissão vem da classificação litúrgica, e
            subsídios da CNBB não são licença geral de reprodução.
          </p>
          <label className="block space-y-1 text-sm font-medium">
            Fundamento
            <NativeSelect value={state.basis} onChange={(event) => set("basis", event.target.value as RightsBasis)} className="w-full">
              {RIGHTS_BASES.map((basis) => (
                <NativeSelectOption key={basis} value={basis}>
                  {RIGHTS_BASIS_LABELS[basis]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Evidência (uso interno, nunca publicada)
            <Textarea value={state.evidence} onChange={(event) => set("evidence", event.target.value)} className="min-h-20" />
            <span className="block text-xs font-normal text-muted-foreground">Pode ficar pendente no rascunho; é exigida para publicar.</span>
          </label>
          {state.content === "hosted" && (
            <>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4" checked={state.displayChordPro} onChange={(event) => set("displayChordPro", event.target.checked)} />
                Exibir a letra e a cifra no catálogo
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4" checked={state.shareChordPro} onChange={(event) => set("shareChordPro", event.target.checked)} />
                Incluir a cifra em links públicos de repertórios
              </label>
            </>
          )}
          {state.content === "external-link" && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4" checked={state.linkExternalSource} onChange={(event) => set("linkExternalSource", event.target.checked)} />
              Mostrar o link para a fonte externa
            </label>
          )}
          {state.content === "metadata-only" && (
            <p className="text-sm text-muted-foreground">Sem cifra e sem link: só título, autoria e referências aparecem ao público.</p>
          )}
        </fieldset>

        <div className="form-actions">
          {error && <div className="w-full"><FormError message={error} /></div>}
          <Button type="submit" size="lg" disabled={pending}>
            {song ? "Salvar alterações" : "Criar rascunho"}
          </Button>
          <Link href="/admin/catalogo" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-10 px-4")}>
            Voltar à lista
          </Link>
        </div>
      </form>

      {song ? (
        <>
          <section className="space-y-4">
            <SectionTitle id="classificacao" hint="Pode ser salva incompleta. Classificação salva ou importada nunca conta como conferida.">
              C. Classificação litúrgica
            </SectionTitle>
            <CatalogClassificationEditor key={`${song.id}-${song.revision}`} api={api} song={song} onSaved={setSong} />
          </section>

          <section className="space-y-4">
            <SectionTitle id="revisao">D. Revisão</SectionTitle>
            <CatalogReviewPanel key={`revisao-${song.revision}`} api={api} song={song} onSaved={setSong} />
            <div className="space-y-2 rounded-xl border p-4">
              <h3 className="font-medium">Publicação</h3>
              {problems.length > 0 && song.status !== "published" && (
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                  {problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {song.status !== "published" && (
                  <Button type="button" variant="outline" size="lg" className="h-10 px-4" disabled={pending || problems.length > 0} onClick={() => void run(() => api.publish(song), "Música publicada.")}>
                    Publicar
                  </Button>
                )}
                {song.status === "published" && (
                  <Button type="button" variant="outline" size="lg" className="h-10 px-4" disabled={pending} onClick={() => void run(() => api.unpublish(song), "Música despublicada.")}>
                    Despublicar
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Direitos aprovados em {new Date(song.rights.approvedAt).toLocaleString("pt-BR")} pela conta {song.rights.approvedBy}.
              </p>
            </div>
          </section>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Crie o rascunho para continuar com a classificação litúrgica e a revisão.
        </p>
      )}
    </div>
  );
}
