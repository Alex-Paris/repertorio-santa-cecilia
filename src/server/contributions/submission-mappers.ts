import "server-only";

import type {
  AdminSubmission,
  AdminSubmissionSummary,
  DuplicateMatch,
  MySubmission,
  SubmissionHistoryEntry,
  SubmissionSnapshot,
  SubmissionSummary,
} from "@/features/contributions/domain/submission";
import type {
  CatalogSubmissionDocument,
  SubmissionSnapshotDocument,
} from "@/server/database/models/catalog-submission-model";

export type ResultingSong = { id: string; title: string; published: boolean };

export function toSnapshot(document: SubmissionSnapshotDocument): SubmissionSnapshot {
  return {
    title: document.title,
    artist: document.artist ?? "",
    originalKey: document.originalKey,
    contentType: document.contentType,
    ...(document.chordPro !== undefined ? { chordPro: document.chordPro } : {}),
    ...(document.sourceUrl !== undefined ? { sourceUrl: document.sourceUrl } : {}),
  };
}

/** Histórico para o colaborador: sem identificar quem decidiu na administração. */
function toHistory(document: CatalogSubmissionDocument): SubmissionHistoryEntry[] {
  return (document.history ?? []).map((entry) => ({
    action: entry.action,
    actor: entry.actor,
    at: entry.at.toISOString(),
    version: entry.version,
    ...(entry.note ? { note: entry.note } : {}),
  }));
}

/** Justificativa da última decisão, enquanto ela vale: some quando a proposta volta à análise. */
function reviewNote(document: Pick<CatalogSubmissionDocument, "status" | "review">): string | undefined {
  const decided = document.status === "needs_changes" || document.status === "approved" || document.status === "rejected";
  return decided ? document.review?.note || undefined : undefined;
}

export function toMySubmission(document: CatalogSubmissionDocument, resulting: ResultingSong | null): MySubmission {
  return {
    id: document.id,
    personalSongId: document.personalSongId,
    sourceSongRevision: document.sourceSongRevision,
    version: document.version,
    snapshot: toSnapshot(document.snapshot),
    suggestedClassification: {
      moments: [...(document.suggestedClassification?.moments ?? [])],
      seasons: [...(document.suggestedClassification?.seasons ?? [])],
      celebrations: [...(document.suggestedClassification?.celebrations ?? [])],
      themes: [...(document.suggestedClassification?.themes ?? [])],
    },
    video: document.videoReference
      ? {
          provider: "youtube",
          videoId: document.videoReference.videoId,
          ...(document.videoReference.title ? { title: document.videoReference.title } : {}),
          kind: document.videoReference.kind,
          ownPerformance: document.videoReference.ownPerformance,
        }
      : null,
    rights: {
      status: document.rightsDeclaration.status,
      license: {
        display: document.rightsDeclaration.license.display,
        reproduce: document.rightsDeclaration.license.reproduce,
        redistribute: document.rightsDeclaration.license.redistribute,
      },
      declarationVersion: document.rightsDeclaration.declarationVersion,
      acceptedAt: document.rightsDeclaration.acceptedAt.toISOString(),
      ...(document.rightsDeclaration.note ? { note: document.rightsDeclaration.note } : {}),
    },
    credit: {
      show: document.publicCreditPreference.show,
      ...(document.publicCreditPreference.name ? { name: document.publicCreditPreference.name } : {}),
    },
    ...(document.duplicateJustification ? { duplicateJustification: document.duplicateJustification } : {}),
    ...(document.message ? { message: document.message } : {}),
    status: document.status,
    ...(reviewNote(document) ? { reviewNote: reviewNote(document) } : {}),
    ...(resulting ? { resultingCatalogSong: resulting } : {}),
    history: toHistory(document),
    previousVersions: (document.previousVersions ?? []).map((entry) => ({
      version: entry.version,
      snapshot: toSnapshot(entry.snapshot),
      sourceSongRevision: entry.sourceSongRevision,
      submittedAt: entry.submittedAt.toISOString(),
    })),
    revision: document.revision,
    createdAt: document.createdAt.toISOString(),
    submittedAt: document.submittedAt.toISOString(),
    reviewedAt: document.reviewedAt ? document.reviewedAt.toISOString() : null,
    updatedAt: document.updatedAt.toISOString(),
  };
}

/** Listas não carregam a cifra, as versões anteriores nem o histórico. */
export type ListedSubmission = Omit<CatalogSubmissionDocument, "history" | "previousVersions">;

export function toSubmissionSummary(document: ListedSubmission, resulting: ResultingSong | null): SubmissionSummary {
  return {
    id: document.id,
    personalSongId: document.personalSongId,
    title: document.snapshot.title,
    artist: document.snapshot.artist ?? "",
    status: document.status,
    version: document.version,
    ...(reviewNote(document) ? { reviewNote: reviewNote(document) } : {}),
    ...(resulting ? { resultingCatalogSong: resulting } : {}),
    revision: document.revision,
    submittedAt: document.submittedAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

export function toAdminSubmission(
  document: CatalogSubmissionDocument,
  submittedBy: AdminSubmission["submittedBy"],
  duplicates: DuplicateMatch[],
): AdminSubmission {
  const { resultingCatalogSong: _resulting, ...mine } = toMySubmission(document, null);
  void _resulting;
  return {
    ...mine,
    // Na administração, o histórico inclui as decisões, mas não quem as tomou: isso fica no banco.
    submittedBy,
    duplicates,
    resultingCatalogSongId: document.resultingCatalogSongId ?? null,
    review: document.review
      ? {
          by: document.review.by,
          at: document.review.at.toISOString(),
          decision: document.review.decision,
          ...(document.review.mode ? { mode: document.review.mode } : {}),
          ...(document.review.note ? { note: document.review.note } : {}),
        }
      : null,
  };
}

export function toAdminSummary(document: ListedSubmission, submitterName: string | null): AdminSubmissionSummary {
  return {
    id: document.id,
    title: document.snapshot.title,
    artist: document.snapshot.artist ?? "",
    status: document.status,
    version: document.version,
    submitterName,
    hasContent: Boolean(document.snapshot.chordPro?.trim()),
    hasVideo: document.videoReference !== null && document.videoReference !== undefined,
    rightsStatus: document.rightsDeclaration.status,
    submittedAt: document.submittedAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}
