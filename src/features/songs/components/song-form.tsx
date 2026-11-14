"use client";

import { cn } from "cn";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { FormError } from "@/components/layout/form-error";
import { FormField, getFieldA11yProps } from "@/components/layout/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RevisionConflict } from "@/features/library/components/revision-conflict";
import { useSessionDraft } from "@/features/library/components/use-library";
import { songRepository } from "@/features/library/data/browser-library";
import { getLibraryErrorMessage, LibraryError } from "@/features/library/domain/library-errors";
import { showToast } from "@/lib/utils/toast";

import { MUSICAL_KEYS, type MusicalKey } from "../domain/musical-key";
import { CONTENT_TYPE_LABELS, CONTENT_TYPES, type ContentType, type Song } from "../domain/song";
import {
  EMPTY_SONG_FORM,
  parseSongForm,
  SONG_FORM_FIELDS,
  songToFormValues,
  type SongFormErrors,
  type SongFormField,
  type SongFormValues,
} from "../services/song-form";
import { ChordProEditor } from "./chordpro-editor";

interface SongFormProps {
  song?: Song;
  /** Destino ao salvar ou cancelar uma edição. */
  returnHref?: string;
}

/** Rascunho em texto simples, para guardar fora do aplicativo. */
function formatSongDraft(values: SongFormValues): string {
  const content = values.contentType === "external-link" ? values.sourceUrl : values.chordPro;
  return [
    `Título: ${values.title}`,
    `Artista: ${values.artist}`,
    `Tom original: ${values.originalKey}`,
    `Tipo: ${CONTENT_TYPE_LABELS[values.contentType]}`,
    "",
    content,
  ].join("\n");
}

function SongVersion({ song }: { song: Song }) {
  return (
    <div className="space-y-1">
      <p className="font-medium wrap-break-word">{song.title}</p>
      <p className="text-muted-foreground wrap-break-word">
        {song.artist} · {song.originalKey} · {CONTENT_TYPE_LABELS[song.contentType]}
      </p>
      <pre className="max-h-48 overflow-auto font-mono text-xs whitespace-pre-wrap">
        {song.contentType === "external-link" ? song.sourceUrl : (song.chordPro ?? "")}
      </pre>
    </div>
  );
}

export function SongForm({ song, returnHref }: SongFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [initialValues, setInitialValues] = useState<SongFormValues>(() =>
    song ? songToFormValues(song) : EMPTY_SONG_FORM,
  );
  const [values, setValues] = useState(initialValues);
  // A revisão do que foi carregado: atualizar a tela não muda a base do rascunho.
  const [baseRevision, setBaseRevision] = useState(song?.revision);
  const [conflict, setConflict] = useState(false);
  const [errors, setErrors] = useState<SongFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useSessionDraft(JSON.stringify(values) !== JSON.stringify(initialValues));

  function setField<Field extends SongFormField>(field: Field, value: SongFormValues[Field]): void {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function focusFirstInvalidField(formErrors: SongFormErrors): void {
    const field = SONG_FORM_FIELDS.find((candidate) => formErrors[candidate]);
    formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaveError(null);
    setConflict(false);

    const parsed = parseSongForm(values);
    if (!parsed.success) {
      setErrors(parsed.errors);
      focusFirstInvalidField(parsed.errors);
      return;
    }

    setSaving(true);
    try {
      const saved = song
        ? await songRepository.update(song.id, parsed.input, baseRevision ?? song.revision)
        : await songRepository.create(parsed.input);

      showToast(song ? "Música atualizada." : "Música cadastrada.");
      if (!song) {
        setValues(EMPTY_SONG_FORM);
      }
      router.push(returnHref ?? `/musicas/${saved.id}`);
    } catch (error) {
      if (error instanceof LibraryError && error.code === "revision-conflict") {
        setConflict(true);
      } else {
        setSaveError(getLibraryErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  }

  const isExternal = values.contentType === "external-link";
  const losesChordPro = isExternal && values.chordPro.trim() !== "";

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="song-title" label="Título" error={errors.title}>
          <Input
            {...getFieldA11yProps("song-title", errors.title)}
            name="title"
            value={values.title}
            onChange={(event) => setField("title", event.target.value)}
            className="h-10"
          />
        </FormField>

        <FormField id="song-artist" label="Artista" error={errors.artist}>
          <Input
            {...getFieldA11yProps("song-artist", errors.artist)}
            name="artist"
            value={values.artist}
            onChange={(event) => setField("artist", event.target.value)}
            className="h-10"
          />
        </FormField>

        <FormField id="song-key" label="Tom original" error={errors.originalKey}>
          <NativeSelect
            {...getFieldA11yProps("song-key", errors.originalKey)}
            name="originalKey"
            value={values.originalKey}
            onChange={(event) => setField("originalKey", event.target.value as MusicalKey)}
            className="w-full"
          >
            {MUSICAL_KEYS.map((key) => (
              <NativeSelectOption key={key} value={key}>
                {key}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>

        <FormField id="song-type" label="Tipo de conteúdo" error={errors.contentType}>
          <NativeSelect
            {...getFieldA11yProps("song-type", errors.contentType)}
            name="contentType"
            value={values.contentType}
            onChange={(event) => setField("contentType", event.target.value as ContentType)}
            className="w-full"
          >
            {CONTENT_TYPES.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {CONTENT_TYPE_LABELS[type]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
      </div>

      {isExternal ? (
        <FormField
          id="song-url"
          label="Link da fonte original"
          error={errors.sourceUrl}
          hint={
            losesChordPro
              ? "Músicas do tipo link externo não guardam cifra: o texto digitado não será salvo."
              : undefined
          }
        >
          <Input
            {...getFieldA11yProps("song-url", errors.sourceUrl)}
            name="sourceUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={values.sourceUrl}
            onChange={(event) => setField("sourceUrl", event.target.value)}
            className="h-10"
          />
        </FormField>
      ) : (
        <ChordProEditor
          id="song-chordpro"
          value={values.chordPro}
          error={errors.chordPro}
          onChange={(value) => setField("chordPro", value)}
        />
      )}

      {saveError && <FormError message={saveError} />}
      {conflict && song && (
        <RevisionConflict
          message="Esta música foi alterada em outro dispositivo enquanto você a editava."
          loadCurrent={() => songRepository.findById(song.id)}
          renderCurrent={(current) => <SongVersion song={current} />}
          missingCode="song-not-found"
          draftText={formatSongDraft(values)}
          onDiscard={(current) => {
            const next = songToFormValues(current);
            setInitialValues(next);
            setValues(next);
            setErrors({});
            setBaseRevision(current.revision);
            setConflict(false);
          }}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={saving} className="h-10 px-4">
          {saving ? "Salvando…" : "Salvar música"}
        </Button>
        <Link
          href={returnHref ?? "/biblioteca"}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
