import "server-only";

import { LibraryError } from "@/features/library/domain/library-errors";
import { catalogSongSchema, type CatalogSong } from "@/features/catalog/domain/catalog-song";
import type { CatalogLiturgyDocument, CatalogSongDocument } from "@/server/database/models/catalog-song-model";

/** Converte para o domínio. Campos de busca e de banco não saem daqui. */
/** Os campos de busca podem ficar de fora da consulta: não são necessários aqui. */
type CatalogSongFields = Omit<CatalogSongDocument, "searchTokens" | "sortTitle">;

function toLiturgy(liturgy: CatalogLiturgyDocument): unknown {
  return {
    category: liturgy.category,
    moments: [...(liturgy.moments ?? [])],
    seasons: [...(liturgy.seasons ?? [])],
    celebrations: [...(liturgy.celebrations ?? [])],
    themes: [...(liturgy.themes ?? [])],
    scripture: (liturgy.scripture ?? []).map(({ book, chapter, verseStart, verseEnd }) => ({
      book,
      chapter,
      ...(verseStart == null ? {} : { verseStart }),
      ...(verseEnd == null ? {} : { verseEnd }),
    })),
    avoidSeasons: [...(liturgy.avoidSeasons ?? [])],
    suitabilityNotes: liturgy.suitabilityNotes ?? "",
    editorialRationale: liturgy.editorialRationale ?? "",
    guidanceSource: liturgy.guidanceSource ?? "",
    officialReference: liturgy.officialReference ?? "",
    classifiedBy: liturgy.classifiedBy,
    classifiedAt: liturgy.classifiedAt.toISOString(),
    reviewStatus: liturgy.reviewStatus ?? "pending_review",
    review: liturgy.review ? { by: liturgy.review.by, at: liturgy.review.at.toISOString(), source: liturgy.review.source } : null,
    dispute: liturgy.dispute ? { note: liturgy.dispute.note, by: liturgy.dispute.by, at: liturgy.dispute.at.toISOString() } : null,
  };
}

export function toCatalogSong(document: CatalogSongFields): CatalogSong {
  const { id, title, artist, originalKey, contentType, chordPro, sourceUrl, status, rights, revision, liturgy } = document;

  const result = catalogSongSchema.safeParse({
    id,
    title,
    artist,
    ...(originalKey ? { originalKey } : {}),
    contentType,
    ...(contentType === "external-link" ? { sourceUrl } : {}),
    ...((contentType === "original" || contentType === "authorized") && chordPro !== undefined ? { chordPro } : {}),
    ...(document.importKey ? { importKey: document.importKey } : {}),
    ...(document.compositionReference ? { compositionReference: document.compositionReference } : {}),
    metadataSources: (document.metadataSources ?? []).map(({ title: sourceTitle, url, accessedAt }) => ({
      title: sourceTitle,
      ...(url ? { url } : {}),
      ...(accessedAt ? { accessedAt } : {}),
    })),
    status,
    rights: {
      basis: rights.basis,
      evidence: rights.evidence ?? "",
      displayChordPro: rights.displayChordPro,
      shareChordPro: rights.shareChordPro,
      // Músicas anteriores à Etapa 2E.4 não têm o campo: o link externo continua visível.
      linkExternalSource: rights.linkExternalSource ?? true,
      approvedBy: rights.approvedBy,
      approvedAt: rights.approvedAt.toISOString(),
    },
    revision,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    publishedAt: document.publishedAt ? document.publishedAt.toISOString() : null,
    liturgy: liturgy ? toLiturgy(liturgy) : null,
    ...(document.video
      ? {
          video: {
            provider: document.video.provider,
            videoId: document.video.videoId,
            ...(document.video.title ? { title: document.video.title } : {}),
            ...(document.video.startSeconds ? { startSeconds: document.video.startSeconds } : {}),
            kind: document.video.kind,
            ...(document.video.submissionId ? { submissionId: document.video.submissionId } : {}),
            approvedBy: document.video.approvedBy,
            approvedAt: document.video.approvedAt.toISOString(),
          },
        }
      : {}),
    ...(document.contributions && document.contributions.length > 0
      ? {
          contributions: document.contributions.map((entry) => ({
            submissionId: entry.submissionId,
            submissionVersion: entry.submissionVersion,
            mode: entry.mode,
            fields: [...(entry.fields ?? [])],
            approvedBy: entry.approvedBy,
            approvedAt: entry.approvedAt.toISOString(),
            ...(entry.publicCredit ? { publicCredit: entry.publicCredit } : {}),
            ...(entry.license
              ? {
                  license: {
                    display: entry.license.display,
                    reproduce: entry.license.reproduce,
                    redistribute: entry.license.redistribute,
                    declarationVersion: entry.license.declarationVersion,
                    acceptedAt: entry.license.acceptedAt.toISOString(),
                  },
                }
              : {}),
          })),
        }
      : {}),
  });

  if (!result.success) {
    throw new LibraryError("persistence-failed");
  }
  return result.data;
}
