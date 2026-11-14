import "server-only";

import { LibraryError } from "@/features/library/domain/library-errors";
import type { Repertoire } from "@/features/repertoires/domain/repertoire";
import { repertoireSchema } from "@/features/repertoires/domain/repertoire-schema";
import type { Song } from "@/features/songs/domain/song";
import { songSchema } from "@/features/songs/domain/song-schema";
import type { RepertoireDocument } from "@/server/database/models/repertoire-model";
import type { SongDocument } from "@/server/database/models/song-model";

/** Converte para o modelo de domínio. `ownerId` e campos internos não saem daqui. */
export function toDomainSong(document: SongDocument): Song {
  const { id, title, artist, originalKey, contentType, chordPro, sourceUrl } = document;

  const result = songSchema.safeParse({
    id,
    title,
    artist,
    originalKey,
    contentType,
    revision: document.revision ?? 1,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    ...(contentType === "external-link" ? { sourceUrl } : {}),
    ...(contentType !== "external-link" && chordPro !== undefined ? { chordPro } : {}),
  });

  if (!result.success) {
    throw new LibraryError("persistence-failed");
  }
  return result.data;
}

export function toDomainRepertoire(document: RepertoireDocument): Repertoire {
  const result = repertoireSchema.safeParse({
    id: document.id,
    name: document.name,
    description: document.description,
    ...(document.mass
      ? {
          mass: {
            date: document.mass.date,
            title: document.mass.title,
            ...(document.mass.celebrationId ? { celebrationId: document.mass.celebrationId } : {}),
            ...(document.mass.celebrationRevision ? { celebrationRevision: document.mass.celebrationRevision } : {}),
          },
        }
      : {}),
    revision: document.revision ?? 1,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    items: document.items.map(({ id, songId, source, position, notes, transposeSemitones, moment }) => ({
      id,
      songId,
      source: source ?? "personal",
      position,
      transposeSemitones,
      ...(notes === undefined ? {} : { notes }),
      ...(moment == null ? {} : { moment }),
    })),
  });

  if (!result.success) {
    throw new LibraryError("persistence-failed");
  }
  return result.data;
}
