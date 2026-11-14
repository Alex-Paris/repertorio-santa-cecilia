import { collectFieldErrors } from "@/lib/utils/collect-field-errors";

import type { MusicalKey } from "../domain/musical-key";
import type { ContentType, SongInput, SongRecord } from "../domain/song";
import { songInputSchema } from "../domain/song-schema";

export interface SongFormValues {
  title: string;
  artist: string;
  originalKey: MusicalKey;
  contentType: ContentType;
  chordPro: string;
  sourceUrl: string;
}

export type SongFormField = keyof SongFormValues;

export type SongFormErrors = Partial<Record<SongFormField, string>>;

export const SONG_FORM_FIELDS: readonly SongFormField[] = [
  "title",
  "artist",
  "originalKey",
  "contentType",
  "chordPro",
  "sourceUrl",
];

export const EMPTY_SONG_FORM: SongFormValues = {
  title: "",
  artist: "",
  originalKey: "C",
  contentType: "original",
  chordPro: "",
  sourceUrl: "",
};

export function songToFormValues(song: SongRecord): SongFormValues {
  return {
    title: song.title,
    artist: song.artist,
    originalKey: song.originalKey,
    contentType: song.contentType,
    chordPro: song.chordPro ?? "",
    sourceUrl: song.sourceUrl ?? "",
  };
}

/** Mantém somente os campos do tipo escolhido. O texto da cifra é preservado como foi digitado. */
function toSongCandidate(values: SongFormValues): unknown {
  const common = {
    title: values.title,
    artist: values.artist,
    originalKey: values.originalKey,
    contentType: values.contentType,
  };

  if (values.contentType === "external-link") {
    return { ...common, sourceUrl: values.sourceUrl };
  }

  return values.chordPro.trim() === "" ? common : { ...common, chordPro: values.chordPro };
}

export type SongFormResult =
  | { success: true; input: SongInput }
  | { success: false; errors: SongFormErrors };

export function parseSongForm(values: SongFormValues): SongFormResult {
  const result = songInputSchema.safeParse(toSongCandidate(values));

  return result.success
    ? { success: true, input: result.data }
    : { success: false, errors: collectFieldErrors(result.error.issues, SONG_FORM_FIELDS) };
}
