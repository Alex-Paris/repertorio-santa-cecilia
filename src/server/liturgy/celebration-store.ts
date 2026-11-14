import "server-only";

import type { ClientSession } from "mongoose";

import { tokenize, escapeRegExp, parseSearchQuery } from "@/features/catalog/domain/catalog-search";
import { LibraryError } from "@/features/library/domain/library-errors";
import {
  MASS_VARIANTS,
  type CelebrationPage,
  type CelebrationQuery,
  type LiturgicalCalendarProvider,
  DEFAULT_CALENDAR,
} from "@/features/liturgy/domain/calendar";
import {
  celebrationInputSchema,
  changedCelebrationFields,
  pickCelebrationInput,
  toCelebrationSummary,
  toPublicCelebration,
  type CelebrationInput,
  type CelebrationRecord,
} from "@/features/liturgy/domain/celebration-record";
import { checkReviewRequest, reviewRequestSchema, statusAfterEdit, type ReviewRequest } from "@/features/liturgy/domain/review";
import { createId } from "@/lib/utils/create-id";
import {
  CelebrationHistoryModel,
  type CelebrationHistoryDocument,
} from "@/server/database/models/liturgical-celebration-history-model";
import {
  LiturgicalCelebrationModel,
  type LiturgicalCelebrationDocument,
} from "@/server/database/models/liturgical-celebration-model";
import { assertRevision, isValidEntityId, runPersistence, runTransaction } from "@/server/repositories/persistence";

type StoredCelebration = Omit<LiturgicalCelebrationDocument, "searchTokens">;
/** O mínimo para montar o domínio; os campos de controle ficam de fora das leituras públicas. */
type RecordSource = Omit<LiturgicalCelebrationDocument, "searchTokens" | "createdBy" | "updatedBy" | "dioceseKey">;

/** Documento para o domínio, validado. Um documento fora do formato não chega a ninguém. */
export function toCelebrationRecord(document: RecordSource): CelebrationRecord {
  const input = celebrationInputSchema.safeParse(
    JSON.parse(
      JSON.stringify({
        date: document.date,
        country: document.country,
        scope: document.scope,
        ...(document.diocese ? { diocese: document.diocese } : {}),
        celebrationKey: document.celebrationKey,
        massVariant: document.massVariant,
        title: document.title,
        rank: document.rank,
        season: document.season,
        lectionaryCycle: { sunday: document.lectionaryCycle.sunday, weekday: document.lectionaryCycle.weekday ?? null },
        liturgicalColor: document.liturgicalColor ?? null,
        readings: document.readings,
        unverifiedReadings: document.unverifiedReadings,
        celebrations: document.celebrations,
        biblicalThemes: document.biblicalThemes,
        notes: document.notes,
        sources: document.sources,
      }),
    ),
  );
  if (!input.success) {
    throw new LibraryError("persistence-failed");
  }

  return {
    ...input.data,
    id: document.id,
    reviewStatus: document.reviewStatus,
    approval: document.approval
      ? {
          by: document.approval.by,
          at: document.approval.at.toISOString(),
          revision: document.approval.revision,
          sourceIds: [...document.approval.sourceIds],
        }
      : null,
    dispute: document.dispute
      ? {
          fields: [...document.dispute.fields],
          note: document.dispute.note,
          by: document.dispute.by,
          at: document.dispute.at.toISOString(),
        }
      : null,
    revision: document.revision,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

/** Palavras do título, para a busca por prefixo; o mesmo critério da busca do catálogo. */
export function celebrationSearchTokens(title: string): string[] {
  return [...new Set(tokenize(title))];
}

function variantOrder(document: Pick<StoredCelebration, "massVariant" | "scope">): number {
  const scope = ["universal", "national", "diocesan"].indexOf(document.scope);
  return MASS_VARIANTS.indexOf(document.massVariant) * 10 + scope;
}

/** Calendário nacional e universal; com uma diocese, também a particularidade dela. */
function dioceseFilter(diocese?: string): Record<string, unknown> {
  return { country: "BR", dioceseKey: { $in: diocese ? ["", diocese] : [""] } };
}

function queryFilter(query: CelebrationQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = { ...dioceseFilter(query.diocese) };
  if (query.from || query.to) {
    filter.date = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
  }
  if (query.season) {
    filter.season = query.season;
  }
  if (query.status) {
    filter.reviewStatus = query.status;
  }
  const tokens = parseSearchQuery(query.q ?? "");
  if (tokens.length > 0) {
    filter.$and = tokens.map((token) => ({ searchTokens: { $regex: `^${escapeRegExp(token)}` } }));
  }
  return filter;
}

const SUMMARY_PROJECTION = {
  _id: 0,
  id: 1,
  date: 1,
  title: 1,
  massVariant: 1,
  season: 1,
  rank: 1,
  scope: 1,
  diocese: 1,
  revision: 1,
  reviewStatus: 1,
  liturgicalColor: 1,
} as const;

async function searchCelebrations(query: CelebrationQuery): Promise<CelebrationPage> {
  return runPersistence(async () => {
    const filter = queryFilter(query);
    const [total, documents] = [
      await LiturgicalCelebrationModel.countDocuments(filter),
      await LiturgicalCelebrationModel.find(filter, SUMMARY_PROJECTION)
        .sort({ date: 1, massVariant: 1, id: 1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .lean(),
    ];
    return {
      celebrations: documents.map((document) => toCelebrationSummary(document as Parameters<typeof toCelebrationSummary>[0])),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  });
}

const PUBLIC_EXCLUDED = { _id: 0, searchTokens: 0, createdBy: 0, updatedBy: 0 } as const;

/**
 * Calendário lido do MongoDB. Uma consulta por pedido, sem N+1, e nenhuma API externa:
 * o que não está na base não existe aqui. Sem cache: uma revisão vale na próxima leitura.
 */
export const mongoCalendarProvider: LiturgicalCalendarProvider = {
  id: "repertorio-web-mongodb",
  calendar: DEFAULT_CALENDAR,

  getByDate: (date, options = {}) =>
    runPersistence(async () => {
      const documents = await LiturgicalCelebrationModel.find({ ...dioceseFilter(options.diocese), date }, PUBLIC_EXCLUDED).lean();
      return documents
        .sort((a, b) => variantOrder(a) - variantOrder(b) || a.id.localeCompare(b.id))
        .map((document) => toPublicCelebration(toCelebrationRecord(document)));
    }),

  getById: async (celebrationId) => {
    if (!isValidEntityId(celebrationId)) {
      return null;
    }
    return runPersistence(async () => {
      const document = await LiturgicalCelebrationModel.findOne({ id: celebrationId }, PUBLIC_EXCLUDED).lean();
      return document ? toPublicCelebration(toCelebrationRecord(document)) : null;
    });
  },

  search: searchCelebrations,
};

export type CelebrationHistoryEntry = Omit<CelebrationHistoryDocument, "at" | "content"> & {
  at: string;
  content?: CelebrationInput;
};

export interface LiturgyAdminService {
  list(query: CelebrationQuery): Promise<CelebrationPage>;
  get(id: string): Promise<CelebrationRecord>;
  create(input: CelebrationInput): Promise<CelebrationRecord>;
  update(id: string, input: CelebrationInput, expectedRevision: number): Promise<CelebrationRecord>;
  review(id: string, request: ReviewRequest, expectedRevision: number): Promise<CelebrationRecord>;
  history(id: string): Promise<CelebrationHistoryEntry[]>;
}

function validate(input: CelebrationInput): CelebrationInput {
  const result = celebrationInputSchema.safeParse(input);
  if (!result.success) {
    throw new LibraryError("invalid-data", result.error.issues[0]?.message);
  }
  return pickCelebrationInput(result.data);
}

function contentFields(input: CelebrationInput) {
  return {
    ...input,
    dioceseKey: input.diocese ?? "",
    searchTokens: celebrationSearchTokens(input.title),
  };
}

async function writeHistory(entry: Omit<CelebrationHistoryDocument, "id">, session: ClientSession): Promise<void> {
  await CelebrationHistoryModel.create([{ ...entry, id: createId() }], { session });
}

/**
 * Operações da administração litúrgica. Quem chama já conferiu o papel administrativo.
 * Toda escrita confere a revisão e grava o histórico na mesma transação.
 */
export function createLiturgyAdminService(adminUserId: string): LiturgyAdminService {
  async function load(id: string, session?: ClientSession): Promise<StoredCelebration> {
    if (!isValidEntityId(id)) {
      throw new LibraryError("celebration-not-found");
    }
    const document = await LiturgicalCelebrationModel.findOne({ id }, { _id: 0, searchTokens: 0 })
      .session(session ?? null)
      .lean();
    if (!document) {
      throw new LibraryError("celebration-not-found");
    }
    return document;
  }

  async function assertUniqueSlot(input: CelebrationInput, session: ClientSession, exceptId?: string): Promise<void> {
    const clash = await LiturgicalCelebrationModel.exists({
      country: input.country,
      dioceseKey: input.diocese ?? "",
      date: input.date,
      celebrationKey: input.celebrationKey,
      massVariant: input.massVariant,
      ...(exceptId ? { id: { $ne: exceptId } } : {}),
    }).session(session);
    if (clash) {
      throw new LibraryError(
        "conflict",
        "Já existe esta celebração, com o mesmo formulário, nesta data e neste calendário.",
      );
    }
  }

  /** Grava com a revisão no filtro: uma alteração concorrente nunca é sobrescrita. */
  async function writeWithRevision(
    id: string,
    expectedRevision: number,
    update: Record<string, unknown>,
    session: ClientSession,
  ): Promise<StoredCelebration> {
    const updated = await LiturgicalCelebrationModel.findOneAndUpdate(
      { id, revision: expectedRevision },
      update,
      { session, returnDocument: "after", projection: { _id: 0, searchTokens: 0 } },
    ).lean();
    if (!updated) {
      throw new LibraryError("revision-conflict");
    }
    return updated;
  }

  return {
    list: searchCelebrations,

    get: (id) => runPersistence(async () => toCelebrationRecord(await load(id))),

    create: async (input) => {
      const data = validate(input);
      return runTransaction(async (session) => {
        await assertUniqueSlot(data, session);
        const now = new Date();
        const id = createId();
        const [created] = await LiturgicalCelebrationModel.create(
          [
            {
              ...contentFields(data),
              id,
              // Nenhuma celebração nasce revisada: a aprovação é sempre um passo separado.
              reviewStatus: "pending_review",
              approval: null,
              dispute: null,
              revision: 1,
              createdAt: now,
              updatedAt: now,
              createdBy: adminUserId,
              updatedBy: adminUserId,
            },
          ],
          { session },
        );
        await writeHistory(
          {
            celebrationId: id,
            action: "create",
            fromRevision: null,
            toRevision: 1,
            fromStatus: null,
            toStatus: "pending_review",
            changedFields: Object.keys(data).sort(),
            actor: adminUserId,
            at: now,
            content: data,
          },
          session,
        );
        const { searchTokens: _tokens, ...stored } = created.toObject() as LiturgicalCelebrationDocument;
        void _tokens;
        return toCelebrationRecord(stored);
      });
    },

    update: async (id, input, expectedRevision) => {
      const data = validate(input);
      assertRevision(expectedRevision);
      return runTransaction(async (session) => {
        const current = toCelebrationRecord(await load(id, session));
        if (current.revision !== expectedRevision) {
          throw new LibraryError("revision-conflict");
        }
        const changed = changedCelebrationFields(pickCelebrationInput(current), data);
        if (changed.length === 0) {
          return current;
        }
        await assertUniqueSlot(data, session, id);

        // Conteúdo revisado que muda volta à revisão: a aprovação antiga não vale para o novo conteúdo.
        const status = statusAfterEdit(current.reviewStatus);
        const now = new Date();
        const updated = await writeWithRevision(
          id,
          expectedRevision,
          {
            $set: {
              ...contentFields(data),
              reviewStatus: status,
              approval: null,
              revision: expectedRevision + 1,
              updatedAt: now,
              updatedBy: adminUserId,
            },
            ...(data.diocese ? {} : { $unset: { diocese: 1 } }),
          },
          session,
        );
        await writeHistory(
          {
            celebrationId: id,
            action: "update",
            fromRevision: expectedRevision,
            toRevision: expectedRevision + 1,
            fromStatus: current.reviewStatus,
            toStatus: status,
            changedFields: changed,
            actor: adminUserId,
            at: now,
            content: data,
          },
          session,
        );
        return toCelebrationRecord(updated);
      });
    },

    review: async (id, request, expectedRevision) => {
      const parsed = reviewRequestSchema.safeParse(request);
      if (!parsed.success) {
        throw new LibraryError("invalid-data", parsed.error.issues[0]?.message);
      }
      assertRevision(expectedRevision);
      const action = parsed.data;

      return runTransaction(async (session) => {
        const current = toCelebrationRecord(await load(id, session));
        if (current.revision !== expectedRevision) {
          throw new LibraryError("revision-conflict");
        }
        const check = checkReviewRequest(current, action);
        if (!check.ok) {
          throw new LibraryError("invalid-data", check.message);
        }

        const now = new Date();
        const set: Record<string, unknown> = {
          reviewStatus: check.status,
          revision: expectedRevision + 1,
          updatedAt: now,
          updatedBy: adminUserId,
        };
        if (action.action === "approve") {
          // A aprovação vale para o conteúdo da revisão que a pessoa conferiu.
          set.approval = { by: adminUserId, at: now, revision: expectedRevision, sourceIds: action.sourceIds };
          set.dispute = null;
        } else if (action.action === "dispute") {
          set.approval = null;
          set.dispute = { fields: action.fields, note: action.note, by: adminUserId, at: now };
        } else {
          set.approval = null;
          set.dispute = null;
        }

        const updated = await writeWithRevision(id, expectedRevision, { $set: set }, session);
        await writeHistory(
          {
            celebrationId: id,
            action: action.action,
            fromRevision: expectedRevision,
            toRevision: expectedRevision + 1,
            fromStatus: current.reviewStatus,
            toStatus: check.status,
            changedFields: action.action === "dispute" ? [...action.fields] : [],
            actor: adminUserId,
            at: now,
            ...(action.note ? { note: action.note } : {}),
            ...(action.action === "approve" ? { approvedRevision: expectedRevision, sourceIds: action.sourceIds } : {}),
          },
          session,
        );
        return toCelebrationRecord(updated);
      });
    },

    history: (id) =>
      runPersistence(async () => {
        await load(id);
        const entries = await CelebrationHistoryModel.find({ celebrationId: id }, { _id: 0 })
          .sort({ toRevision: -1, at: -1 })
          .limit(200)
          .lean();
        return entries.map((entry) => ({ ...entry, at: entry.at.toISOString() }) as CelebrationHistoryEntry);
      }),
  };
}
