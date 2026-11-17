import "server-only";

import type { ClientSession } from "mongoose";

import { tokenize } from "@/features/catalog/domain/catalog-search";
import {
  ACTIVE_SUBMISSION_STATUSES,
  buildSubmissionSnapshot,
  findDuplicateMatches,
  nextSubmissionStatus,
  resubmissionRequestSchema,
  submissionRequestSchema,
  toSubmissionVideo,
  RIGHTS_DECLARATION_VERSION,
  normalizePublicName,
  type DuplicateMatch,
  type MySubmission,
  type SubmissionPreview,
  type SubmissionSnapshot,
  type SubmissionSummary,
  type ValidResubmissionRequest,
} from "@/features/contributions/domain/submission";
import { LibraryError } from "@/features/library/domain/library-errors";
import { createId } from "@/lib/utils/create-id";
import { CatalogSongModel } from "@/server/database/models/catalog-song-model";
import {
  CatalogSubmissionModel,
  SubmissionQuotaModel,
  type CatalogSubmissionDocument,
} from "@/server/database/models/catalog-submission-model";
import { SongModel } from "@/server/database/models/song-model";
import { toDomainSong } from "@/server/repositories/document-mappers";
import {
  assertRevision,
  isValidEntityId,
  runPersistence,
  runTransaction,
} from "@/server/repositories/persistence";

import { getContributionLimits, type ContributionLimits } from "./contribution-config";
import { toMySubmission, toSubmissionSummary, type ResultingSong } from "./submission-mappers";

const ACTIVE = [...ACTIVE_SUBMISSION_STATUSES];
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DUPLICATE_CANDIDATES = 50;
const MAX_LISTED = 200;

/** `null` vira "sem sessão" no Mongoose: as consultas fora de transação continuam iguais. */
function inSession(session?: ClientSession): ClientSession | null {
  return session ?? null;
}

/**
 * Músicas do catálogo com o mesmo título normalizado (sem acentos, caixa, pontuação nem
 * espaços extras). As palavras do título filtram no índice; a comparação final é exata.
 * O colaborador só vê músicas publicadas: rascunhos da administração não vazam.
 */
export async function findCatalogDuplicates(
  song: Pick<SubmissionSnapshot, "title" | "artist">,
  { publishedOnly, exclude = [] }: { publishedOnly: boolean; exclude?: string[] },
  session?: ClientSession,
): Promise<DuplicateMatch[]> {
  const tokens = [...new Set(tokenize(song.title))].slice(0, 12);
  if (tokens.length === 0) {
    return [];
  }
  const documents = await CatalogSongModel.find(
    {
      ...(publishedOnly ? { status: "published" } : {}),
      searchTokens: { $all: tokens },
      ...(exclude.length > 0 ? { id: { $nin: exclude } } : {}),
    },
    { _id: 0, id: 1, title: 1, artist: 1, status: 1 },
  )
    .limit(MAX_DUPLICATE_CANDIDATES)
    .session(inSession(session))
    .lean();

  return findDuplicateMatches(
    song,
    documents.map((document) => ({
      id: document.id,
      title: document.title,
      artist: document.artist ?? "",
      status: document.status,
    })),
  );
}

/** Música oficial resultante, com título e situação atuais. */
export async function resultingSongs(ids: (string | null | undefined)[]): Promise<Map<string, ResultingSong>> {
  const wanted = [...new Set(ids.filter((id): id is string => typeof id === "string"))];
  if (wanted.length === 0) {
    return new Map();
  }
  const songs = await CatalogSongModel.find({ id: { $in: wanted } }, { _id: 0, id: 1, title: 1, status: 1 }).lean();
  return new Map(songs.map((song) => [song.id, { id: song.id, title: song.title, published: song.status === "published" }]));
}

function snapshotWithinLimits(snapshot: SubmissionSnapshot, limits: ContributionLimits): SubmissionSnapshot {
  if ((snapshot.chordPro?.length ?? 0) > limits.maxChordProLength) {
    throw new LibraryError(
      "submission-content-too-large",
      `A cifra tem mais de ${limits.maxChordProLength.toLocaleString("pt-BR")} caracteres, o limite para sugestões.`,
    );
  }
  return snapshot;
}

/** Declarações do colaborador, como serão guardadas. O link do vídeo vira referência estruturada. */
function declaredFields(request: ValidResubmissionRequest, now: Date) {
  return {
    suggestedClassification: request.suggestedClassification,
    videoReference: toSubmissionVideo(request.video),
    rightsDeclaration: {
      status: request.rights.status,
      license: request.rights.license,
      declarationVersion: RIGHTS_DECLARATION_VERSION,
      acceptedAt: now,
      ...(request.rights.note ? { note: request.rights.note } : {}),
    },
    publicCreditPreference: request.credit.show
      ? { show: true, name: normalizePublicName(request.credit.name ?? "") }
      : { show: false },
  };
}

function requireJustification(duplicates: DuplicateMatch[], justification: string | undefined): void {
  if (duplicates.some((match) => match.kind === "same-song") && !justification) {
    throw new LibraryError("submission-duplicates");
  }
}

export interface SubmissionService {
  preview(songId: string): Promise<SubmissionPreview>;
  /** `created: false` quando o mesmo pedido já tinha sido gravado. */
  create(input: unknown): Promise<{ submission: MySubmission; created: boolean }>;
  listMine(): Promise<SubmissionSummary[]>;
  getMine(id: string): Promise<MySubmission>;
  withdraw(id: string, expectedRevision: number): Promise<MySubmission>;
  resubmit(id: string, expectedRevision: number, input: unknown): Promise<MySubmission>;
}

/** Operações do colaborador, sempre restritas à conta da sessão. */
export function createSubmissionService(userId: string, limits: ContributionLimits = getContributionLimits()): SubmissionService {
  async function loadMine(id: string, session?: ClientSession): Promise<CatalogSubmissionDocument> {
    if (!isValidEntityId(id)) {
      throw new LibraryError("submission-not-found");
    }
    const document = await CatalogSubmissionModel.findOne({ id, submittedBy: userId }).session(inSession(session)).lean();
    if (!document) {
      throw new LibraryError("submission-not-found");
    }
    return document;
  }

  async function withResulting(document: CatalogSubmissionDocument): Promise<MySubmission> {
    const resulting = await resultingSongs([document.resultingCatalogSongId]);
    return toMySubmission(document, resulting.get(document.resultingCatalogSongId ?? "") ?? null);
  }

  async function loadPersonalSong(songId: string, session?: ClientSession) {
    if (!isValidEntityId(songId)) {
      throw new LibraryError("song-not-found");
    }
    const document = await SongModel.findOne({ ownerId: userId, id: songId }).session(inSession(session)).lean();
    if (!document) {
      throw new LibraryError("song-not-found");
    }
    return toDomainSong(document);
  }

  return {
    preview: (songId) =>
      runPersistence(async () => {
        const song = await loadPersonalSong(songId);
        const now = Date.now();
        const [duplicates, active, pending, today] = await Promise.all([
          findCatalogDuplicates(song, { publishedOnly: true }),
          CatalogSubmissionModel.findOne(
            { submittedBy: userId, personalSongId: songId, status: { $in: ACTIVE } },
            { _id: 0, id: 1, status: 1 },
          ).lean(),
          CatalogSubmissionModel.countDocuments({ submittedBy: userId, status: { $in: ACTIVE } }),
          CatalogSubmissionModel.countDocuments({ submittedBy: userId, createdAt: { $gte: new Date(now - DAY_MS) } }),
        ]);
        return {
          snapshot: buildSubmissionSnapshot(song),
          sourceSongRevision: song.revision,
          duplicates,
          activeSubmission: active ? { id: active.id, status: active.status } : null,
          limits: {
            maxPending: limits.maxPending,
            pending,
            maxPerDay: limits.maxPerDay,
            today,
            maxChordProLength: limits.maxChordProLength,
          },
        };
      }),

    create: async (input) => {
      const parsed = submissionRequestSchema.safeParse(input);
      if (!parsed.success) {
        throw new LibraryError("invalid-data", parsed.error.issues[0]?.message);
      }
      const request = parsed.data;

      return runTransaction(async (session) => {
        // Repetir o pedido (resposta perdida, clique duplo) devolve a proposta já gravada.
        const existing = await CatalogSubmissionModel.findOne({ submittedBy: userId, requestId: request.requestId })
          .session(session)
          .lean();
        if (existing) {
          if (existing.personalSongId !== request.songId) {
            throw new LibraryError("conflict", "Este pedido já foi usado para outra sugestão.");
          }
          return { submission: toMySubmission(existing, null), created: false };
        }

        const now = new Date();
        // Envios simultâneos da mesma conta disputam este documento: a transação perdedora
        // recomeça e conta de novo, então os limites valem mesmo com várias abas ou instâncias.
        await SubmissionQuotaModel.updateOne(
          { userId },
          { $set: { lastSubmissionAt: now }, $inc: { writes: 1 } },
          { upsert: true, session },
        );

        const song = await loadPersonalSong(request.songId, session);
        const snapshot = snapshotWithinLimits(buildSubmissionSnapshot(song), limits);

        if (await CatalogSubmissionModel.exists({ submittedBy: userId, personalSongId: song.id, status: { $in: ACTIVE } }).session(session)) {
          throw new LibraryError("submission-active");
        }
        const pending = await CatalogSubmissionModel.countDocuments({ submittedBy: userId, status: { $in: ACTIVE } }).session(session);
        if (pending >= limits.maxPending) {
          throw new LibraryError("submission-limit-exceeded");
        }
        const today = await CatalogSubmissionModel.countDocuments({
          submittedBy: userId,
          createdAt: { $gte: new Date(now.getTime() - DAY_MS) },
        }).session(session);
        if (today >= limits.maxPerDay) {
          throw new LibraryError("submission-daily-limit");
        }

        requireJustification(await findCatalogDuplicates(snapshot, { publishedOnly: true }, session), request.duplicateJustification);

        const document: CatalogSubmissionDocument = {
          id: createId(),
          submittedBy: userId,
          requestId: request.requestId,
          personalSongId: song.id,
          sourceSongRevision: song.revision,
          version: 1,
          snapshot,
          previousVersions: [],
          ...declaredFields(request, now),
          ...(request.duplicateJustification ? { duplicateJustification: request.duplicateJustification } : {}),
          ...(request.message ? { message: request.message } : {}),
          status: "pending",
          review: null,
          resultingCatalogSongId: null,
          history: [{ action: "submitted", by: userId, actor: "author", at: now, version: 1 }],
          revision: 1,
          createdAt: now,
          submittedAt: now,
          reviewedAt: null,
          updatedAt: now,
        };
        await CatalogSubmissionModel.create([document], { session });
        return { submission: toMySubmission(document, null), created: true };
      });
    },

    listMine: () =>
      runPersistence(async () => {
        const documents = await CatalogSubmissionModel.find(
          { submittedBy: userId },
          { "snapshot.chordPro": 0, previousVersions: 0, history: 0 },
        )
          .sort({ submittedAt: -1, id: 1 })
          .limit(MAX_LISTED)
          .lean();
        const resulting = await resultingSongs(documents.map((document) => document.resultingCatalogSongId));
        return documents.map((document) =>
          toSubmissionSummary(document, resulting.get(document.resultingCatalogSongId ?? "") ?? null),
        );
      }),

    getMine: (id) => runPersistence(async () => withResulting(await loadMine(id))),

    // Retirar tira a proposta da fila e guarda só o mínimo para auditoria: a cifra enviada sai.
    withdraw: async (id, expectedRevision) => {
      assertRevision(expectedRevision);
      return runPersistence(async () => {
        const current = await loadMine(id);
        const next = nextSubmissionStatus(current.status, "withdraw");
        if (!next) {
          throw new LibraryError("submission-already-reviewed");
        }
        if (current.revision !== expectedRevision) {
          throw new LibraryError("revision-conflict");
        }
        const now = new Date();
        const updated = await CatalogSubmissionModel.findOneAndUpdate(
          { id, submittedBy: userId, revision: expectedRevision, status: current.status },
          {
            $set: {
              status: next,
              previousVersions: (current.previousVersions ?? []).map((entry) => ({
                ...entry,
                snapshot: { ...entry.snapshot, chordPro: undefined, sourceUrl: undefined },
              })),
              updatedAt: now,
              revision: expectedRevision + 1,
            },
            $unset: { "snapshot.chordPro": 1, "snapshot.sourceUrl": 1 },
            $push: { history: { action: "withdraw", by: userId, actor: "author", at: now, version: current.version } },
          },
          { returnDocument: "after" },
        ).lean();
        if (!updated) {
          throw new LibraryError("revision-conflict");
        }
        return withResulting(updated);
      });
    },

    resubmit: async (id, expectedRevision, input) => {
      assertRevision(expectedRevision);
      const parsed = resubmissionRequestSchema.safeParse(input);
      if (!parsed.success) {
        throw new LibraryError("invalid-data", parsed.error.issues[0]?.message);
      }
      const request = parsed.data;

      const document = await runTransaction(async (session) => {
        const current = await loadMine(id, session);
        // Pedido repetido depois de gravado: devolve o estado atual, sem outra versão.
        if ((current.history ?? []).some((entry) => entry.requestId === request.requestId)) {
          return current;
        }
        const next = nextSubmissionStatus(current.status, "resubmit");
        if (!next) {
          throw new LibraryError("submission-already-reviewed");
        }
        if (current.revision !== expectedRevision) {
          throw new LibraryError("revision-conflict");
        }

        const song = await loadPersonalSong(current.personalSongId, session).catch((error: unknown) => {
          if (error instanceof LibraryError && error.code === "song-not-found") {
            throw new LibraryError(
              "song-not-found",
              "A música particular desta sugestão foi excluída. Retire a sugestão ou envie outra a partir da sua biblioteca.",
            );
          }
          throw error;
        });
        const snapshot = snapshotWithinLimits(buildSubmissionSnapshot(song), limits);
        requireJustification(await findCatalogDuplicates(snapshot, { publishedOnly: true }, session), request.duplicateJustification);

        const now = new Date();
        const version = current.version + 1;
        const unset: Record<string, 1> = {};
        if (!request.duplicateJustification) unset.duplicateJustification = 1;
        if (!request.message) unset.message = 1;

        const updated = await CatalogSubmissionModel.findOneAndUpdate(
          { id, submittedBy: userId, revision: expectedRevision, status: current.status },
          {
            $set: {
              status: next,
              version,
              snapshot,
              sourceSongRevision: song.revision,
              ...declaredFields(request, now),
              ...(request.duplicateJustification ? { duplicateJustification: request.duplicateJustification } : {}),
              ...(request.message ? { message: request.message } : {}),
              submittedAt: now,
              updatedAt: now,
              revision: expectedRevision + 1,
            },
            ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
            // A versão anterior continua guardada: a proposta nunca é trocada em silêncio.
            $push: {
              previousVersions: {
                version: current.version,
                snapshot: current.snapshot,
                sourceSongRevision: current.sourceSongRevision,
                submittedAt: current.submittedAt,
              },
              history: { action: "resubmit", by: userId, actor: "author", at: now, version, requestId: request.requestId },
            },
          },
          { returnDocument: "after", session },
        ).lean();
        if (!updated) {
          throw new LibraryError("revision-conflict");
        }
        return updated;
      });
      return runPersistence(() => withResulting(document));
    },
  };
}
