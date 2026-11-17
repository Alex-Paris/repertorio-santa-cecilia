"use client";

import { cn } from "cn";
import { CircleAlert, ExternalLink, Info, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { FormError } from "@/components/layout/form-error";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getLibraryErrorMessage, LibraryError } from "@/features/library/domain/library-errors";
import { ChipGroup, ChoiceGroup } from "@/features/liturgy/components/form-fields";
import {
  BIBLICAL_THEMES,
  LITURGICAL_CELEBRATIONS,
  LITURGICAL_MOMENTS,
  LITURGICAL_SEASONS,
} from "@/features/liturgy/domain/vocabulary";
import { ChordSheet } from "@/features/songs/components/chord-sheet";
import { KeyLabel } from "@/features/songs/components/key-label";
import { CONTENT_TYPE_LABELS } from "@/features/songs/domain/song";
import { parseYouTubeId } from "@/features/songs/domain/video-reference";
import { createRequestId } from "@/lib/utils/request-id";
import { showToast } from "@/lib/utils/toast";

import { createSubmissionApi } from "../data/submission-api";
import {
  canLicenseContent,
  EMPTY_SUGGESTED_CLASSIFICATION,
  NO_LICENSE,
  PUBLIC_NAME_MAX,
  RIGHTS_DECLARATION_VERSION,
  RIGHTS_STATUS_LABELS,
  RIGHTS_STATUSES,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_TEXT_MAX,
  resubmissionRequestSchema,
  type DuplicateMatch,
  type MySubmission,
  type RightsStatus,
  type SubmissionPreview,
  type SuggestedClassification,
} from "../domain/submission";

type PreviewState =
  | { status: "loading" }
  | { status: "error"; message: string; notFound: boolean }
  | { status: "ready"; preview: SubmissionPreview };

type DuplicateChoice = "different" | "same";

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-3 rounded-xl border bg-card p-4 md:p-5">
      <div>
        <h2 id={id} className="font-display text-lg font-semibold text-heading">
          {title}
        </h2>
        {description && <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>}
      </div>
      {children}
    </section>
  );
}

function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  const Icon = tone === "warning" ? CircleAlert : Info;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
        tone === "warning" ? "border-gold/60 bg-gold/10" : "bg-background/60",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-gold-strong" aria-hidden />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}

function DuplicateList({ matches }: { matches: readonly DuplicateMatch[] }) {
  return (
    <ul className="space-y-1.5">
      {matches.map((match) => (
        <li key={match.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="min-w-0 wrap-break-word">
            <span className="font-medium">{match.title}</span>
            <span className="text-muted-foreground">
              {" "}
              · {match.artist || "autoria não informada"}
              {match.kind === "same-title" ? " · mesmo título, outra autoria" : ""}
            </span>
          </span>
          <Link
            href={`/catalogo/${encodeURIComponent(match.id)}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-3"
          >
            Ver no catálogo
            <ExternalLink className="size-3.5" aria-hidden />
            <span className="sr-only">(abre em outra aba)</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

interface SubmissionFormProps {
  userId: string;
  songId: string;
  /** Reenvio de uma sugestão com pedido de correções: os campos começam com a versão anterior. */
  resubmitting?: MySubmission;
  onResubmitted?: (submission: MySubmission) => void;
}

/**
 * Formulário curto para sugerir uma música da própria biblioteca ao catálogo. O conteúdo vem
 * da música particular, que continua privada; nada é publicado sem a revisão da equipe.
 */
export function SubmissionForm({ userId, songId, resubmitting, onResubmitted }: SubmissionFormProps) {
  const api = useMemo(() => createSubmissionApi(userId), [userId]);
  const router = useRouter();
  const ids = useId();
  // Um identificador por formulário: repetir o envio não duplica a sugestão.
  const [requestId] = useState(createRequestId);
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const [reload, setReload] = useState(0);

  const initial = resubmitting;
  const [classification, setClassification] = useState<SuggestedClassification>(
    initial?.suggestedClassification ?? EMPTY_SUGGESTED_CLASSIFICATION,
  );
  const [videoUrl, setVideoUrl] = useState(initial?.video ? `https://www.youtube.com/watch?v=${initial.video.videoId}` : "");
  const [videoTitle, setVideoTitle] = useState(initial?.video?.title ?? "");
  const [ownPerformance, setOwnPerformance] = useState(initial?.video?.ownPerformance ?? false);
  const [rightsStatus, setRightsStatus] = useState<RightsStatus | null>(initial?.rights.status ?? null);
  const [licenseContent, setLicenseContent] = useState(initial?.rights.license.display ?? false);
  const [redistribute, setRedistribute] = useState(initial?.rights.license.redistribute ?? false);
  const [rightsNote, setRightsNote] = useState(initial?.rights.note ?? "");
  const [creditShow, setCreditShow] = useState(initial?.credit.show ?? false);
  const [creditName, setCreditName] = useState(initial?.credit.name ?? "");
  const [duplicateChoice, setDuplicateChoice] = useState<DuplicateChoice | null>(null);
  const [justification, setJustification] = useState(initial?.duplicateJustification ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.preview(songId, controller.signal).then(
      (preview) => setState({ status: "ready", preview }),
      (cause: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            message: getLibraryErrorMessage(cause),
            notFound: cause instanceof LibraryError && cause.code === "song-not-found",
          });
        }
      },
    );
    return () => controller.abort();
  }, [api, songId, reload]);

  if (state.status === "loading") {
    return <ContentSkeleton />;
  }
  if (state.status === "error") {
    return (
      <div className="max-w-2xl space-y-3">
        <FormError message={state.notFound ? "Esta música não está na sua biblioteca." : state.message} />
        <Link href="/biblioteca" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Voltar às suas músicas
        </Link>
      </div>
    );
  }

  const { preview } = state;
  const { snapshot, duplicates, activeSubmission, limits } = preview;
  const hasContent = snapshot.contentType !== "external-link" && Boolean(snapshot.chordPro?.trim());
  const sameSong = duplicates.filter((match) => match.kind === "same-song");
  const sameTitle = duplicates.filter((match) => match.kind === "same-title");
  const mayLicense = rightsStatus !== null && canLicenseContent(rightsStatus) && hasContent;
  const videoId = videoUrl.trim() ? parseYouTubeId(videoUrl) : null;
  const tooLarge = (snapshot.chordPro?.length ?? 0) > limits.maxChordProLength;

  // Uma sugestão em andamento para esta música: acompanhar, não enviar outra.
  if (!resubmitting && activeSubmission) {
    return (
      <div className="max-w-2xl space-y-4">
        <Notice>
          <p>
            Esta música já tem uma sugestão <strong>{SUBMISSION_STATUS_LABELS[activeSubmission.status].toLowerCase()}</strong>.
          </p>
          <p className="text-muted-foreground">Acompanhe a análise e, se a equipe pedir correções, envie uma nova versão por lá.</p>
        </Notice>
        <Link
          href={`/conta/sugestoes/${encodeURIComponent(activeSubmission.id)}`}
          className={cn(buttonVariants({ size: "lg" }))}
        >
          Ver a sugestão
        </Link>
      </div>
    );
  }

  const overLimit = !resubmitting && (limits.pending >= limits.maxPending || limits.today >= limits.maxPerDay);

  function buildJustification(): string | undefined {
    if (sameSong.length === 0) {
      return justification.trim() || undefined;
    }
    if (duplicateChoice === "same") {
      const target = sameSong.map((match) => `"${match.title}" (${match.id})`).join(", ");
      return [`É a mesma música que ${target}: sugiro correção, classificação ou vídeo para ela.`, justification.trim()]
        .filter(Boolean)
        .join(" ")
        .slice(0, SUBMISSION_TEXT_MAX);
    }
    return justification.trim() || undefined;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (sameSong.length > 0 && duplicateChoice === null) {
      setError("Diga se a sua sugestão é outra música ou um complemento da que já está no catálogo.");
      return;
    }
    if (sameSong.length > 0 && duplicateChoice === "different" && !justification.trim()) {
      setError("Explique em poucas palavras por que esta é outra música.");
      return;
    }
    if (rightsStatus === null) {
      setError("Informe a situação dos direitos.");
      return;
    }

    const body = {
      requestId,
      suggestedClassification: classification,
      video: videoUrl.trim()
        ? {
            url: videoUrl.trim(),
            ...(videoTitle.trim() ? { title: videoTitle.trim() } : {}),
            kind: ownPerformance ? ("performance" as const) : ("reference" as const),
            ownPerformance,
          }
        : null,
      rights: {
        status: rightsStatus,
        license: mayLicense && licenseContent ? { display: true, reproduce: true, redistribute } : NO_LICENSE,
        accepted: accepted as true,
        ...(rightsNote.trim() ? { note: rightsNote.trim() } : {}),
      },
      credit: creditShow ? { show: true, name: creditName } : { show: false },
      ...(buildJustification() ? { duplicateJustification: buildJustification() } : {}),
      ...(message.trim() ? { message: message.trim() } : {}),
    };

    // As mesmas regras do servidor, que valida tudo de novo.
    const parsed = resubmissionRequestSchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os campos da sugestão.");
      return;
    }

    setPending(true);
    try {
      if (resubmitting) {
        const submission = await api.resubmit(resubmitting, body);
        showToast("Nova versão enviada para análise.");
        onResubmitted?.(submission);
      } else {
        const submission = await api.create({ songId, ...body });
        showToast("Sugestão enviada. A equipe do catálogo vai analisar.");
        router.push(`/conta/sugestoes/${encodeURIComponent(submission.id)}`);
      }
    } catch (cause) {
      if (cause instanceof LibraryError && cause.code === "submission-duplicates") {
        setReload((value) => value + 1);
      }
      if (cause instanceof LibraryError && (cause.code === "remote-unavailable" || cause.code === "write-uncertain")) {
        // O mesmo identificador vai no próximo envio: repetir não cria uma segunda sugestão.
        setError("Não foi possível confirmar o envio. Tente de novo: a mesma sugestão não será duplicada.");
      } else {
        setError(getLibraryErrorMessage(cause));
      }
    } finally {
      setPending(false);
    }
  }

  const field = (name: string) => `${ids}-${name}`;

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate className="max-w-2xl space-y-4">
      <Section
        title="O que será enviado"
        description="Uma cópia desta versão da música. A sua música continua particular e você pode editá-la à vontade: a sugestão não muda junto."
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Título</dt>
          <dd className="min-w-0 font-medium wrap-break-word">{snapshot.title}</dd>
          <dt className="text-muted-foreground">Autoria</dt>
          <dd className="min-w-0 wrap-break-word">{snapshot.artist || "Não informada"}</dd>
          <dt className="text-muted-foreground">Tom</dt>
          <dd>
            <KeyLabel musicalKey={snapshot.originalKey} />
          </dd>
          <dt className="text-muted-foreground">Conteúdo</dt>
          <dd>
            {snapshot.contentType === "external-link"
              ? "Link externo (o link não é publicado no catálogo)"
              : hasContent
                ? CONTENT_TYPE_LABELS[snapshot.contentType]
                : "Sem cifra: só título, autoria e tom"}
          </dd>
        </dl>
        {hasContent && snapshot.chordPro && (
          <details className="rounded-lg border bg-background/60">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Ver a letra e a cifra enviadas</summary>
            <div className="max-h-80 overflow-auto border-t px-3 py-3">
              <ChordSheet source={snapshot.chordPro} fontSize={15} />
            </div>
          </details>
        )}
        {tooLarge && (
          <FormError
            message={`A cifra tem mais de ${limits.maxChordProLength.toLocaleString("pt-BR")} caracteres, o limite para sugestões.`}
          />
        )}
        <p className="text-sm">
          <Link href={`/musicas/${encodeURIComponent(songId)}/editar`} className="font-medium underline underline-offset-3">
            Editar a música antes de enviar
          </Link>
        </p>
      </Section>

      {duplicates.length > 0 && (
        <Section title="Encontramos músicas semelhantes no catálogo.">
          {sameSong.length > 0 && <DuplicateList matches={sameSong} />}
          {sameTitle.length > 0 && (
            <>
              {sameSong.length > 0 && <p className="text-sm text-muted-foreground">Também com o mesmo título:</p>}
              <DuplicateList matches={sameTitle} />
              <p className="text-sm text-muted-foreground">Mesmo título não quer dizer mesma música: confira a autoria.</p>
            </>
          )}
          {sameSong.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">O que você quer fazer?</legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name={field("duplicata")}
                  className="mt-1"
                  checked={duplicateChoice === "same"}
                  onChange={() => setDuplicateChoice("same")}
                />
                <span>É a mesma música: quero sugerir correção, classificação ou vídeo para ela.</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name={field("duplicata")}
                  className="mt-1"
                  checked={duplicateChoice === "different"}
                  onChange={() => setDuplicateChoice("different")}
                />
                <span>É outra música: vou explicar a diferença.</span>
              </label>
            </fieldset>
          )}
          {(sameSong.length > 0 || justification) && (
            <label className="block space-y-1 text-sm font-medium">
              {duplicateChoice === "same" ? "O que corrigir ou acrescentar (opcional)" : "Justificativa"}
              <Textarea
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                maxLength={SUBMISSION_TEXT_MAX}
                className="min-h-16 font-normal"
                placeholder={
                  duplicateChoice === "same"
                    ? "Ex.: o tom está errado; falta a segunda estrofe."
                    : "Ex.: mesmo título, mas é outra melodia e outra letra."
                }
              />
            </label>
          )}
        </Section>
      )}

      <Section title="Direitos" description="A equipe confere antes de publicar. Sua declaração não é prova de titularidade.">
        <fieldset className="space-y-2">
          <legend className="sr-only">Situação dos direitos</legend>
          {RIGHTS_STATUSES.map((status) => (
            <label key={status} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name={field("direitos")}
                className="mt-1"
                checked={rightsStatus === status}
                onChange={() => {
                  setRightsStatus(status);
                  if (!canLicenseContent(status)) {
                    setLicenseContent(false);
                    setRedistribute(false);
                  }
                }}
              />
              <span>{RIGHTS_STATUS_LABELS[status]}</span>
            </label>
          ))}
        </fieldset>
        {rightsStatus !== null && !mayLicense && (
          <Notice>
            <p>
              {hasContent
                ? "Sem autorização de quem compôs, a equipe pode publicar só título, autoria e tom. A letra e a cifra continuam na sua biblioteca."
                : "Sem cifra na música, a sugestão vale para título, autoria, tom, classificação e vídeo."}
            </p>
          </Notice>
        )}
        {mayLicense && (
          <div className="space-y-2 rounded-lg border bg-background/60 p-3">
            <p className="text-sm font-medium">Autorização não exclusiva (você continua com todos os direitos)</p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={licenseContent}
                onChange={(event) => {
                  setLicenseContent(event.target.checked);
                  if (!event.target.checked) setRedistribute(false);
                }}
              />
              <span>Autorizo exibir e reproduzir a letra e a cifra no catálogo (leitura, transposição e apresentação).</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={redistribute}
                disabled={!licenseContent}
                onChange={(event) => setRedistribute(event.target.checked)}
              />
              <span>Autorizo incluir a cifra em links públicos de repertórios.</span>
            </label>
            <p className="text-xs text-muted-foreground">Sem estas marcações, a equipe pode publicar só os metadados.</p>
          </div>
        )}
        <label className="block space-y-1 text-sm font-medium">
          Observação sobre os direitos (opcional)
          <Textarea
            value={rightsNote}
            onChange={(event) => setRightsNote(event.target.value)}
            maxLength={SUBMISSION_TEXT_MAX}
            className="min-h-14 font-normal"
            placeholder="Ex.: autorização por escrito do compositor em 2025."
          />
        </label>
      </Section>

      <details className="group rounded-xl border bg-card" open={Boolean(initial?.video)}>
        <summary className="cursor-pointer px-4 py-3 font-display text-lg font-semibold text-heading md:px-5">
          Vídeo de referência <span className="font-sans text-sm font-normal text-muted-foreground">(opcional)</span>
        </summary>
        <div className="space-y-3 border-t px-4 py-4 md:px-5">
          <label className="block space-y-1 text-sm font-medium" htmlFor={field("video")}>
            Link do YouTube
            <Input
              id={field("video")}
              type="url"
              inputMode="url"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              aria-invalid={videoUrl.trim() !== "" && !videoId ? true : undefined}
              className="font-normal"
            />
            <span className={cn("block text-xs font-normal", videoUrl.trim() && !videoId ? "text-destructive" : "text-muted-foreground")}>
              {videoUrl.trim() && !videoId
                ? "Use um link do YouTube (youtube.com/watch, youtu.be ou Shorts)."
                : "Só um vídeo por sugestão. Não cole código de incorporação."}
            </span>
          </label>
          {videoUrl.trim() && (
            <>
              <label className="block space-y-1 text-sm font-medium">
                Título do vídeo (opcional)
                <Input value={videoTitle} maxLength={200} onChange={(event) => setVideoTitle(event.target.value)} className="font-normal" />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={ownPerformance}
                  onChange={(event) => setOwnPerformance(event.target.checked)}
                />
                <span>Este vídeo é uma apresentação minha.</span>
              </label>
            </>
          )}
        </div>
      </details>

      <details className="rounded-xl border bg-card" open={initial ? Object.values(initial.suggestedClassification).some((list) => list.length > 0) : false}>
        <summary className="cursor-pointer px-4 py-3 font-display text-lg font-semibold text-heading md:px-5">
          Sugestão de uso litúrgico <span className="font-sans text-sm font-normal text-muted-foreground">(opcional)</span>
        </summary>
        <div className="space-y-3 border-t px-4 py-4 md:px-5">
          <p className="text-sm text-muted-foreground">
            É só uma sugestão: a curadoria litúrgica confere antes de a música aparecer nas sugestões para a missa.
          </p>
          <ChipGroup
            legend="Momentos da missa"
            options={LITURGICAL_MOMENTS}
            selected={classification.moments}
            onChange={(moments) => setClassification((current) => ({ ...current, moments }))}
          />
          <ChipGroup
            legend="Tempos litúrgicos"
            options={LITURGICAL_SEASONS}
            selected={classification.seasons}
            onChange={(seasons) => setClassification((current) => ({ ...current, seasons }))}
          />
          <ChoiceGroup
            legend="Celebrações"
            options={LITURGICAL_CELEBRATIONS}
            selected={classification.celebrations}
            onChange={(celebrations) => setClassification((current) => ({ ...current, celebrations }))}
            searchable
          />
          <ChoiceGroup
            legend="Temas"
            options={BIBLICAL_THEMES}
            selected={classification.themes}
            onChange={(themes) => setClassification((current) => ({ ...current, themes }))}
            searchable
          />
        </div>
      </details>

      <Section title="Crédito público" description="Quem enviou não é quem compôs nem quem canta: o crédito aparece discreto, como “Enviado por”.">
        <fieldset className="space-y-2">
          <legend className="sr-only">Crédito público</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name={field("credito")} className="mt-1" checked={!creditShow} onChange={() => setCreditShow(false)} />
            <span>Não mostrar meu nome</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name={field("credito")} className="mt-1" checked={creditShow} onChange={() => setCreditShow(true)} />
            <span>Mostrar um nome público</span>
          </label>
        </fieldset>
        {creditShow && (
          <label className="block space-y-1 text-sm font-medium">
            Nome público
            <Input
              value={creditName}
              maxLength={PUBLIC_NAME_MAX}
              onChange={(event) => setCreditName(event.target.value)}
              placeholder="Ex.: Ministério de Música São José"
              className="font-normal"
            />
            <span className="block text-xs font-normal text-muted-foreground">
              Nunca usamos o seu e-mail nem o nome da conta. A equipe pode ajustar ou não exibir o nome.
            </span>
          </label>
        )}
      </Section>

      <Section title="Envio">
        <label className="block space-y-1 text-sm font-medium">
          Mensagem para a equipe (opcional)
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={SUBMISSION_TEXT_MAX}
            className="min-h-14 font-normal"
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>
            Declaro que as informações são verdadeiras e que não copiei letra ou cifra de sites ou publicações sem
            autorização. Entendo que a equipe pode recusar, ajustar ou retirar a música se houver contestação.
            <span className="block text-xs text-muted-foreground">Texto da declaração: versão {RIGHTS_DECLARATION_VERSION}.</span>
          </span>
        </label>
        {overLimit && (
          <FormError
            message={
              limits.pending >= limits.maxPending
                ? `Você já tem ${limits.pending} sugestões em andamento (limite: ${limits.maxPending}). Aguarde a revisão ou retire alguma.`
                : `Você atingiu o limite de ${limits.maxPerDay} sugestões novas por dia.`
            }
          />
        )}
        {error && <FormError message={error} />}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={pending || overLimit || tooLarge}>
            <Send data-icon="inline-start" aria-hidden />
            {pending ? "Enviando…" : resubmitting ? "Enviar nova versão" : "Enviar sugestão"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {resubmitting
              ? "A versão anterior continua guardada no histórico."
              : `Em andamento: ${limits.pending} de ${limits.maxPending}.`}
          </p>
        </div>
      </Section>
    </form>
  );
}
