import "server-only";

import mongoose, { type ClientSession } from "mongoose";
import { z } from "zod";

import type { CatalogSong } from "@/features/catalog/domain/catalog-song";
import { buildSearchTokens, buildSortTitle } from "@/features/catalog/domain/catalog-search";
import { publicationProblems } from "@/features/catalog/domain/catalog-song";
import {
  approvalRequestSchema,
  canLicenseContent,
  decisionNoteSchema,
  hasSuggestedClassification,
  nextSubmissionStatus,
  normalizePublicName,
  publicNameProblem,
  RIGHTS_STATUS_LABELS,
  SUBMISSION_STATUSES,
  type AdminSubmission,
  type AdminSubmissionSummary,
  type SubmissionAction,
  type SubmissionStatus,
} from "@/features/contributions/domain/submission";
import { isMassCategory } from "@/features/liturgy/domain/vocabulary";
import { LibraryError } from "@/features/library/domain/library-errors";
import { createId } from "@/lib/utils/create-id";
import { toCatalogSong } from "@/server/catalog/catalog-mappers";
import {
  CatalogSongModel,
  type CatalogContributionDocument,
  type CatalogLiturgyDocument,
  type CatalogSongDocument,
} from "@/server/database/models/catalog-song-model";
import {
  CatalogSubmissionModel,
  type CatalogSubmissionDocument,
} from "@/server/database/models/catalog-submission-model";
import { assertRevision, isValidEntityId, runPersistence, runTransaction } from "@/server/repositories/persistence";

import { toAdminSubmission, toAdminSummary } from "./submission-mappers";
import { findCatalogDuplicates } from "./submission-service";

const MAX_LISTED = 200;
const MAX_RATIONALE = 2000;

/** Remoção de vídeo ou crédito de uma música do catálogo (pedido de retirada, contestação). */
export const contributionRemovalSchema = z
  .strictObject({
    video: z.boolean(),
    credit: z.boolean(),
  })
  .refine((value) => value.video || value.credit, "Escolha o que remover.");

export interface ApprovalResult {
  submission: AdminSubmission;
  catalogSong: CatalogSong;
}

export interface SubmissionAdminService {
  list(status?: SubmissionStatus): Promise<AdminSubmissionSummary[]>;
  get(id: string): Promise<AdminSubmission>;
  approve(id: string, expectedRevision: number, input: unknown): Promise<ApprovalResult>;
  reject(id: string, expectedRevision: number, input: unknown): Promise<AdminSubmission>;
  requestChanges(id: string, expectedRevision: number, input: unknown): Promise<AdminSubmission>;
  removeFromCatalogSong(catalogSongId: string, expectedRevision: number, input: unknown): Promise<CatalogSong>;
}

export function isSubmissionStatus(value: unknown): value is SubmissionStatus {
  return typeof value === "string" && (SUBMISSION_STATUSES as readonly string[]).includes(value);
}

/**
 * Nome e e-mail do remetente, lidos da coleção de contas do Better Auth no momento da
 * consulta. A proposta guarda só o identificador da conta; nada disso sai da administração.
 */
async function lookupAccounts(ids: string[]): Promise<Map<string, { name: string; email: string }>> {
  const db = mongoose.connection.db;
  const objectIds = [...new Set(ids)].filter((id) => /^[a-f0-9]{24}$/i.test(id)).map((id) => new mongoose.Types.ObjectId(id));
  if (!db || objectIds.length === 0) {
    return new Map();
  }
  const accounts = await db
    .collection("user")
    .find({ _id: { $in: objectIds } }, { projection: { name: 1, email: 1 } })
    .toArray();
  return new Map(
    accounts.map((account) => [String(account._id), { name: String(account.name ?? ""), email: String(account.email ?? "") }]),
  );
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function rationale(text: string): string {
  return text.length > MAX_RATIONALE ? `${text.slice(0, MAX_RATIONALE - 1)}…` : text;
}

/**
 * Classificação a partir das sugestões: sempre "não conferida". Uma classificação já
 * conferida (ou com divergência aberta) nunca é substituída por informação não verificada.
 */
function classificationFrom(
  submission: CatalogSubmissionDocument,
  current: CatalogLiturgyDocument | undefined,
  adminUserId: string,
  now: Date,
): CatalogLiturgyDocument {
  const suggested = submission.suggestedClassification;
  const origin = `Sugestões da contribuição ${submission.id} (versão ${submission.version}), ainda não conferidas pela curadoria litúrgica.`;

  if (!current) {
    return {
      category: "liturgical",
      moments: [...suggested.moments],
      seasons: [...suggested.seasons],
      celebrations: [...suggested.celebrations],
      themes: [...suggested.themes],
      scripture: [],
      avoidSeasons: [],
      suitabilityNotes: "",
      editorialRationale: origin,
      guidanceSource: "",
      officialReference: "",
      classifiedBy: adminUserId,
      classifiedAt: now,
      reviewStatus: "pending_review",
      review: null,
      dispute: null,
    };
  }
  if (current.reviewStatus === "reviewed" || current.reviewStatus === "disputed") {
    throw new LibraryError(
      "invalid-data",
      "A classificação desta música já foi conferida ou está em divergência. Altere-a pela administração do catálogo.",
    );
  }
  const avoid = current.avoidSeasons ?? [];
  return {
    ...current,
    // Momentos só valem para cantos litúrgicos; um tempo restrito não vira indicado.
    moments: isMassCategory(current.category) ? unique([...(current.moments ?? []), ...suggested.moments]) : [...(current.moments ?? [])],
    seasons: unique([...(current.seasons ?? []), ...suggested.seasons.filter((season) => !avoid.includes(season))]),
    celebrations: unique([...(current.celebrations ?? []), ...suggested.celebrations]),
    themes: unique([...(current.themes ?? []), ...suggested.themes]),
    editorialRationale: rationale([current.editorialRationale, origin].filter(Boolean).join("\n")),
    classifiedBy: adminUserId,
    classifiedAt: now,
    reviewStatus: "pending_review",
    review: null,
    dispute: null,
  };
}

function videoFrom(submission: CatalogSubmissionDocument, verified: boolean, adminUserId: string, now: Date) {
  const video = submission.videoReference;
  if (!video) {
    throw new LibraryError("invalid-data", "Esta sugestão não traz vídeo.");
  }
  if (!verified) {
    throw new LibraryError("invalid-data", "Confirme que o vídeo corresponde a esta música antes de publicá-lo.");
  }
  return {
    provider: "youtube" as const,
    videoId: video.videoId,
    ...(video.title ? { title: video.title } : {}),
    kind: video.kind,
    submissionId: submission.id,
    approvedBy: adminUserId,
    approvedAt: now,
  };
}

/** Registro dos direitos: a declaração do colaborador, conferida pela administração, não é prova. */
function rightsEvidence(submission: CatalogSubmissionDocument, publishContent: boolean, shareContent: boolean): string {
  const declaration = submission.rightsDeclaration;
  const license = declaration.license;
  const yesNo = (value: boolean) => (value ? "sim" : "não");
  return [
    `Contribuição ${submission.id}, versão ${submission.version}, enviada em ${submission.submittedAt.toISOString()}.`,
    `Declaração do colaborador: "${RIGHTS_STATUS_LABELS[declaration.status]}" (texto ${declaration.declarationVersion}, aceito em ${declaration.acceptedAt.toISOString()}).`,
    publishContent
      ? `Autorização não exclusiva declarada: exibição ${yesNo(license.display)}, reprodução ${yesNo(license.reproduce)}, redistribuição em repertórios públicos ${yesNo(license.redistribute)}. Redistribuição aplicada: ${yesNo(shareContent)}.`
      : "Somente metadados: letra e cifra da proposta não foram publicadas.",
    "Declaração não é prova de titularidade; a retirada pode ser pedida a qualquer momento.",
  ].join(" ");
}

/** Operações da fila. Quem chama já conferiu o papel com `isCatalogAdmin`. */
export function createSubmissionAdminService(adminUserId: string): SubmissionAdminService {
  async function load(id: string, session?: ClientSession): Promise<CatalogSubmissionDocument> {
    if (!isValidEntityId(id)) {
      throw new LibraryError("submission-not-found");
    }
    const document = await CatalogSubmissionModel.findOne({ id }).session(session ?? null).lean();
    if (!document) {
      throw new LibraryError("submission-not-found");
    }
    return document;
  }

  async function adminView(document: CatalogSubmissionDocument): Promise<AdminSubmission> {
    const [accounts, duplicates] = await Promise.all([
      lookupAccounts([document.submittedBy]),
      findCatalogDuplicates(document.snapshot, {
        publishedOnly: false,
        exclude: document.resultingCatalogSongId ? [document.resultingCatalogSongId] : [],
      }),
    ]);
    const account = accounts.get(document.submittedBy);
    return toAdminSubmission(document, account ? { id: document.submittedBy, ...account } : null, duplicates);
  }

  /** Confere a transição e a revisão antes de qualquer escrita. */
  function assertDecision(current: CatalogSubmissionDocument, action: SubmissionAction, expectedRevision: number): SubmissionStatus {
    if (current.submittedBy === adminUserId) {
      throw new LibraryError("forbidden", "Quem enviou a contribuição não pode decidir sobre ela.");
    }
    const next = nextSubmissionStatus(current.status, action);
    if (!next) {
      throw new LibraryError("submission-already-reviewed");
    }
    if (current.revision !== expectedRevision) {
      throw new LibraryError("revision-conflict");
    }
    return next;
  }

  async function decide(
    current: CatalogSubmissionDocument,
    expectedRevision: number,
    next: SubmissionStatus,
    review: NonNullable<CatalogSubmissionDocument["review"]>,
    extra: Record<string, unknown>,
    session?: ClientSession,
  ): Promise<CatalogSubmissionDocument> {
    const now = review.at;
    const updated = await CatalogSubmissionModel.findOneAndUpdate(
      // Revisão e situação no filtro da própria escrita: duas decisões nunca valem juntas.
      { id: current.id, revision: expectedRevision, status: current.status },
      {
        $set: {
          status: next,
          review,
          reviewedAt: now,
          updatedAt: now,
          revision: expectedRevision + 1,
          ...extra,
        },
        $push: {
          history: {
            action: review.decision,
            by: adminUserId,
            actor: "admin",
            at: now,
            version: current.version,
            ...(review.note ? { note: review.note } : {}),
          },
        },
      },
      { returnDocument: "after", session: session ?? null },
    ).lean();
    if (!updated) {
      throw new LibraryError("revision-conflict");
    }
    return updated;
  }

  async function noteDecision(id: string, expectedRevision: number, input: unknown, action: "reject" | "request_changes") {
    assertRevision(expectedRevision);
    const parsed = decisionNoteSchema.safeParse(input);
    if (!parsed.success) {
      throw new LibraryError("invalid-data", parsed.error.issues[0]?.message);
    }
    return runPersistence(async () => {
      const current = await load(id);
      const next = assertDecision(current, action, expectedRevision);
      const updated = await decide(current, expectedRevision, next, {
        by: adminUserId,
        at: new Date(),
        decision: action,
        note: parsed.data.note,
      }, {});
      return adminView(updated);
    });
  }

  return {
    list: (status) =>
      runPersistence(async () => {
        const active = !status || status === "pending" || status === "needs_changes";
        const documents = await CatalogSubmissionModel.find(status ? { status } : {}, {
          "snapshot.chordPro": 0,
          previousVersions: 0,
          history: 0,
        })
          // Fila em ordem de chegada; decididas, das mais recentes para as mais antigas.
          .sort(active ? { submittedAt: 1, id: 1 } : { updatedAt: -1, id: 1 })
          .limit(MAX_LISTED)
          .lean();
        // O resumo só indica se havia cifra: a projeção acima a remove, então a consulta é feita à parte.
        const withContent = new Set(
          (
            await CatalogSubmissionModel.find(
              { id: { $in: documents.map((document) => document.id) }, "snapshot.chordPro": { $type: "string", $ne: "" } },
              { _id: 0, id: 1 },
            ).lean()
          ).map((document) => document.id),
        );
        const accounts = await lookupAccounts(documents.map((document) => document.submittedBy));
        return documents.map((document) => ({
          ...toAdminSummary(document, accounts.get(document.submittedBy)?.name ?? null),
          hasContent: withContent.has(document.id),
        }));
      }),

    get: (id) => runPersistence(async () => adminView(await load(id))),

    approve: async (id, expectedRevision, input) => {
      assertRevision(expectedRevision);
      const parsed = approvalRequestSchema.safeParse(input);
      if (!parsed.success) {
        throw new LibraryError("invalid-data", parsed.error.issues[0]?.message);
      }
      const request = parsed.data;

      const outcome = await runTransaction(async (session) => {
        const current = await load(id, session);

        // Pedido repetido (resposta perdida): devolve o resultado já gravado, sem outra música.
        if (current.status === "approved" && current.review?.requestId === request.requestId && current.resultingCatalogSongId) {
          return { submission: current, catalogSongId: current.resultingCatalogSongId };
        }
        const next = assertDecision(current, "approve", expectedRevision);
        if (await CatalogSongModel.exists({ "contributions.submissionId": current.id }).session(session)) {
          throw new LibraryError("submission-already-reviewed");
        }

        const now = new Date();
        const snapshot = current.snapshot;

        if (request.mode === "new") {
          const declaration = current.rightsDeclaration;
          const hasContent =
            (snapshot.contentType === "original" || snapshot.contentType === "authorized") && Boolean(snapshot.chordPro?.trim());
          if (request.publishContent) {
            if (!hasContent) {
              throw new LibraryError("invalid-data", "Esta sugestão não tem letra e cifra para publicar. Aprove só os metadados.");
            }
            if (!canLicenseContent(declaration.status) || !declaration.license.display || !declaration.license.reproduce) {
              throw new LibraryError(
                "invalid-data",
                "O colaborador não autorizou a exibição e a reprodução da letra e da cifra. Aprove só os metadados.",
              );
            }
          }
          if (request.shareContent && !(request.publishContent && declaration.license.redistribute)) {
            throw new LibraryError("invalid-data", "O colaborador não autorizou a redistribuição em repertórios públicos.");
          }

          let publicCredit: string | undefined;
          if (request.creditName !== null) {
            if (!current.publicCreditPreference.show) {
              throw new LibraryError("invalid-data", "O colaborador não autorizou o crédito público.");
            }
            const problem = publicNameProblem(request.creditName);
            if (problem) {
              throw new LibraryError("invalid-data", problem);
            }
            publicCredit = normalizePublicName(request.creditName);
          }

          // Nova checagem de duplicatas dentro da transação: uma música surgida depois da
          // análise interrompe a aprovação em vez de criar um segundo registro global.
          const duplicates = await findCatalogDuplicates(request.editorial, { publishedOnly: false }, session);
          const unseen = duplicates.filter((match) => match.kind === "same-song" && !request.knownDuplicateIds.includes(match.id));
          if (unseen.length > 0) {
            throw new LibraryError(
              "submission-duplicates",
              `Há no catálogo uma música semelhante que não estava na análise: ${unseen.map((match) => match.title).join(", ")}. Recarregue e confira antes de aprovar.`,
            );
          }

          const includeClassification = request.includeClassification && hasSuggestedClassification(current.suggestedClassification);
          const fields = [
            "title",
            "artist",
            "originalKey",
            ...(request.publishContent ? ["chordPro"] : []),
            ...(includeClassification ? ["classification"] : []),
            ...(request.includeVideo ? ["video"] : []),
            ...(publicCredit ? ["credit"] : []),
          ];
          const contribution: CatalogContributionDocument = {
            submissionId: current.id,
            submissionVersion: current.version,
            mode: "new",
            fields,
            approvedBy: adminUserId,
            approvedAt: now,
            ...(publicCredit ? { publicCredit } : {}),
            ...(request.publishContent
              ? {
                  license: {
                    ...declaration.license,
                    declarationVersion: declaration.declarationVersion,
                    acceptedAt: declaration.acceptedAt,
                  },
                }
              : {}),
          };
          const catalogSongId = createId();
          const document: CatalogSongDocument = {
            id: catalogSongId,
            title: request.editorial.title,
            artist: request.editorial.artist,
            originalKey: request.editorial.originalKey ?? snapshot.originalKey,
            contentType: request.publishContent
              ? declaration.status === "own-composition"
                ? "original"
                : "authorized"
              : "metadata-only",
            ...(request.publishContent ? { chordPro: snapshot.chordPro } : {}),
            ...(request.editorial.compositionReference ? { compositionReference: request.editorial.compositionReference } : {}),
            metadataSources: [],
            status: request.publish ? "published" : "draft",
            rights: {
              basis: request.publishContent ? "author-permission" : "public-metadata",
              evidence: rightsEvidence(current, request.publishContent, request.shareContent),
              displayChordPro: request.publishContent,
              shareChordPro: request.publishContent && request.shareContent,
              linkExternalSource: false,
              approvedBy: adminUserId,
              approvedAt: now,
            },
            revision: 1,
            searchTokens: buildSearchTokens(request.editorial.title, request.editorial.artist),
            sortTitle: buildSortTitle(request.editorial.title),
            createdAt: now,
            updatedAt: now,
            ...(request.publish ? { publishedAt: now } : {}),
            ...(includeClassification ? { liturgy: classificationFrom(current, undefined, adminUserId, now) } : {}),
            ...(request.includeVideo ? { video: videoFrom(current, request.videoVerified, adminUserId, now) } : {}),
            contributions: [contribution],
          };
          // Valida com o mesmo esquema do catálogo antes de gravar.
          const song = toCatalogSong(document);
          if (request.publish) {
            const problems = publicationProblems(song);
            if (problems.length > 0) {
              throw new LibraryError("invalid-data", problems.join(" "));
            }
          }
          await CatalogSongModel.create([document], { session });

          const submission = await decide(
            current,
            expectedRevision,
            next,
            {
              by: adminUserId,
              at: now,
              decision: "approve",
              mode: "new",
              requestId: request.requestId,
              ...(request.note ? { note: request.note } : {}),
            },
            { resultingCatalogSongId: catalogSongId },
            session,
          );
          return { submission, catalogSongId };
        }

        // Complemento de uma música existente: só campos vazios ou ainda não conferidos.
        const target = await CatalogSongModel.findOne({ id: request.targetCatalogSongId }, { searchTokens: 0, sortTitle: 0 })
          .session(session)
          .lean();
        if (!target) {
          throw new LibraryError("catalog-song-not-found");
        }
        if (target.revision !== request.targetRevision) {
          throw new LibraryError("revision-conflict", "A música do catálogo mudou desde a análise. Recarregue antes de aprovar.");
        }

        const set: Record<string, unknown> = {};
        const fields: string[] = [];
        if (request.includeClassification) {
          if (!hasSuggestedClassification(current.suggestedClassification)) {
            throw new LibraryError("invalid-data", "Esta sugestão não traz classificação.");
          }
          set.liturgy = classificationFrom(current, target.liturgy, adminUserId, now);
          fields.push("classification");
        }
        if (request.includeVideo) {
          if (target.video) {
            throw new LibraryError("invalid-data", "Esta música já tem vídeo de referência. Remova o atual antes de aceitar outro.");
          }
          set.video = videoFrom(current, request.videoVerified, adminUserId, now);
          fields.push("video");
        }
        if (request.fillOriginalKey) {
          if (target.originalKey) {
            throw new LibraryError("invalid-data", "Esta música já tem tom original; ele não é substituído por uma sugestão.");
          }
          set.originalKey = snapshot.originalKey;
          fields.push("originalKey");
        }

        const contribution: CatalogContributionDocument = {
          submissionId: current.id,
          submissionVersion: current.version,
          mode: "complement",
          fields,
          approvedBy: adminUserId,
          approvedAt: now,
        };
        const updatedTarget = await CatalogSongModel.findOneAndUpdate(
          { id: target.id, revision: request.targetRevision },
          {
            $set: { ...set, revision: request.targetRevision + 1, updatedAt: now },
            $push: { contributions: contribution },
          },
          { returnDocument: "after", projection: { searchTokens: 0, sortTitle: 0 }, session },
        ).lean();
        if (!updatedTarget) {
          throw new LibraryError("revision-conflict");
        }
        toCatalogSong(updatedTarget);

        const submission = await decide(
          current,
          expectedRevision,
          next,
          {
            by: adminUserId,
            at: now,
            decision: "approve",
            mode: "complement",
            requestId: request.requestId,
            ...(request.note ? { note: request.note } : {}),
          },
          { resultingCatalogSongId: target.id },
          session,
        );
        return { submission, catalogSongId: target.id };
      });

      return runPersistence(async () => {
        const song = await CatalogSongModel.findOne({ id: outcome.catalogSongId }, { searchTokens: 0, sortTitle: 0 }).lean();
        if (!song) {
          throw new LibraryError("catalog-song-not-found");
        }
        return { submission: await adminView(outcome.submission), catalogSong: toCatalogSong(song) };
      });
    },

    reject: (id, expectedRevision, input) => noteDecision(id, expectedRevision, input, "reject"),

    requestChanges: (id, expectedRevision, input) => noteDecision(id, expectedRevision, input, "request_changes"),

    // Pedido de retirada ou contestação: tira o vídeo e/ou o crédito, com a revisão esperada.
    removeFromCatalogSong: async (catalogSongId, expectedRevision, input) => {
      assertRevision(expectedRevision);
      const parsed = contributionRemovalSchema.safeParse(input);
      if (!parsed.success) {
        throw new LibraryError("invalid-data", parsed.error.issues[0]?.message);
      }
      if (!isValidEntityId(catalogSongId)) {
        throw new LibraryError("catalog-song-not-found");
      }
      return runPersistence(async () => {
        const current = await CatalogSongModel.findOne({ id: catalogSongId }, { _id: 0, contributions: 1 }).lean();
        if (!current) {
          throw new LibraryError("catalog-song-not-found");
        }
        const unset: Record<string, 1> = {};
        if (parsed.data.video) unset.video = 1;
        // Atualização de lista exige que a lista exista.
        if (parsed.data.credit && (current.contributions?.length ?? 0) > 0) unset["contributions.$[].publicCredit"] = 1;
        const updated = await CatalogSongModel.findOneAndUpdate(
          { id: catalogSongId, revision: expectedRevision },
          { $set: { revision: expectedRevision + 1, updatedAt: new Date() }, $unset: unset },
          { returnDocument: "after", projection: { searchTokens: 0, sortTitle: 0 } },
        ).lean();
        if (!updated) {
          throw (await CatalogSongModel.exists({ id: catalogSongId }))
            ? new LibraryError("revision-conflict")
            : new LibraryError("catalog-song-not-found");
        }
        return toCatalogSong(updated);
      });
    },
  };
}
