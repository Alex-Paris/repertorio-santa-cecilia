import "server-only";

import type { PipelineStage } from "mongoose";
import type { z } from "zod";

import {
  canShareChordPro,
  toCatalogSongView,
  type CatalogSearchParams,
  type CatalogSearchResult,
  type CatalogSong,
  type CatalogSongInput,
  type CatalogSongSummary,
  type CatalogSongView,
  type CatalogStatus,
} from "@/features/catalog/domain/catalog-song";
import {
  buildSearchTokens,
  buildSortTitle,
  escapeRegExp,
  parseSearchQuery,
} from "@/features/catalog/domain/catalog-search";
import { catalogSongInputSchema, publicationProblems } from "@/features/catalog/domain/catalog-song";
import type { CatalogVideoInput } from "@/features/catalog/domain/catalog-video";
import {
  assessCatalogSong,
  assessReadiness,
  type QualityIssue,
  type Readiness,
} from "@/features/catalog/domain/catalog-quality";
import {
  classificationReviewRequestSchema,
  nextClassificationStatus,
  songClassificationInputSchema,
  type ClassificationReviewRequest,
  type SongClassificationInput,
} from "@/features/liturgy/domain/classification";
import type { SuggestionCandidate } from "@/features/liturgy/domain/recommendation";
import type {
  BiblicalThemeId,
  LiturgicalCelebrationId,
  LiturgicalMomentId,
  LiturgicalSeasonId,
} from "@/features/liturgy/domain/vocabulary";
import { LibraryError } from "@/features/library/domain/library-errors";
import { parseYouTubeId } from "@/features/songs/domain/video-reference";
import { createId } from "@/lib/utils/create-id";
import { CatalogAdminModel } from "@/server/database/models/catalog-admin-model";
import {
  CatalogSongModel,
  type CatalogRightsDocument,
  type CatalogSongDocument,
  type CatalogVideoDocument,
} from "@/server/database/models/catalog-song-model";
import { assertRevision, isValidEntityId, runPersistence } from "@/server/repositories/persistence";

import { toCatalogSong } from "./catalog-mappers";

const PUBLISHED = { status: "published" as const };

function searchFilter({ q, moment, season, celebration, theme }: CatalogSearchParams): Record<string, unknown> {
  const tokens = parseSearchQuery(q);
  // Os filtros litúrgicos já chegam validados contra os vocabulários: são igualdades simples.
  const filter: Record<string, unknown> = {
    ...PUBLISHED,
    ...(moment ? { "liturgy.moments": moment } : {}),
    ...(season ? { "liturgy.seasons": season } : {}),
    ...(celebration ? { "liturgy.celebrations": celebration } : {}),
    ...(theme ? { "liturgy.themes": theme } : {}),
  };
  // Cada termo precisa ser o começo de alguma palavra do título ou do artista.
  // Expressões ancoradas em `^` usam o índice multichave de `searchTokens`.
  if (tokens.length > 0) {
    filter.$and = tokens.map((token) => ({ searchTokens: { $regex: `^${escapeRegExp(token)}` } }));
  }
  return filter;
}

/** Link externo cujo endereço não pode ser mostrado aparece ao público como "somente metadados". */
const PUBLIC_CONTENT_TYPE = {
  $cond: [
    { $and: [{ $eq: ["$contentType", "external-link"] }, { $eq: ["$rights.linkExternalSource", false] }] },
    "metadata-only",
    "$contentType",
  ],
};

const HAS_CHORD_PRO = {
  $and: [
    { $eq: ["$rights.displayChordPro", true] },
    { $ne: ["$contentType", "external-link"] },
    { $gt: [{ $strLenCP: { $ifNull: ["$chordPro", ""] } }, 0] },
  ],
};

/** Busca pública: só publicadas, paginada, sem carregar cifras no resultado. */
export function searchCatalog(params: CatalogSearchParams): Promise<CatalogSearchResult> {
  const { page, pageSize } = params;
  return runPersistence(async () => {
    const filter = searchFilter(params);
    const total = await CatalogSongModel.countDocuments(filter);
    const pipeline: PipelineStage[] = [
      { $match: filter },
      { $sort: { sortTitle: 1, id: 1 } },
      { $skip: (page - 1) * pageSize },
      { $limit: pageSize },
      {
        $project: {
          _id: 0,
          id: 1,
          title: 1,
          artist: 1,
          originalKey: 1,
          contentType: PUBLIC_CONTENT_TYPE,
          hasChordPro: HAS_CHORD_PRO,
          moments: { $ifNull: ["$liturgy.moments", []] },
          seasons: { $ifNull: ["$liturgy.seasons", []] },
        },
      },
    ];
    const songs = await CatalogSongModel.aggregate<CatalogSongSummary>(pipeline);

    return { songs, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  });
}

/** Leitura pública de uma música. Rascunhos e despublicadas não existem para o público. */
export function getPublishedCatalogSong(id: string): Promise<CatalogSongView | null> {
  if (!isValidEntityId(id)) {
    return Promise.resolve(null);
  }
  return runPersistence(async () => {
    const document = await CatalogSongModel.findOne({ id, ...PUBLISHED }, { searchTokens: 0, sortTitle: 0 }).lean();
    return document ? toCatalogSongView(toCatalogSong(document)) : null;
  });
}

/** Teto de segurança de candidatas por consulta. A seleção é feita pelo filtro, não por este corte. */
export const MAX_SUGGESTION_CANDIDATES = 2000;

export interface CandidateQuery {
  moments: readonly LiturgicalMomentId[];
  /** Tempo da celebração: descarta, já no banco, músicas próprias de outro tempo ou restritas neste. */
  season?: LiturgicalSeasonId;
  /** Celebrações do vocabulário a que a data corresponde. */
  celebrations?: readonly LiturgicalCelebrationId[];
}

const CANDIDATE_PROJECTION = {
  _id: 0,
  id: 1,
  title: 1,
  artist: 1,
  originalKey: 1,
  contentType: PUBLIC_CONTENT_TYPE,
  hasChordPro: HAS_CHORD_PRO,
  liturgy: {
    category: "$liturgy.category",
    moments: "$liturgy.moments",
    seasons: "$liturgy.seasons",
    celebrations: "$liturgy.celebrations",
    themes: "$liturgy.themes",
    scripture: "$liturgy.scripture",
    avoidSeasons: "$liturgy.avoidSeasons",
    suitabilityNotes: { $ifNull: ["$liturgy.suitabilityNotes", ""] },
    officialReference: { $ifNull: ["$liturgy.officialReference", ""] },
    reviewStatus: { $ifNull: ["$liturgy.reviewStatus", "pending_review"] },
  },
} as const;

/** Filtro das candidatas: só publicadas, litúrgicas, sem divergência e indicadas para os momentos. */
function candidateFilter({ moments, season, celebrations = [] }: CandidateQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    ...PUBLISHED,
    "liturgy.moments": { $in: [...moments] },
    "liturgy.category": { $in: ["liturgical", "proper-text"] },
    // Classificação contestada não embasa sugestão.
    "liturgy.reviewStatus": { $ne: "disputed" },
  };
  if (season) {
    filter["liturgy.avoidSeasons"] = { $ne: season };
    // Música própria de um tempo ou de uma celebração só entra neles; sem escopo, vale para qualquer um.
    filter.$or = [
      { "liturgy.seasons": season },
      ...(celebrations.length > 0 ? [{ "liturgy.celebrations": { $in: [...celebrations] } }] : []),
      { "liturgy.seasons": { $size: 0 }, "liturgy.celebrations": { $size: 0 } },
    ];
  }
  return filter;
}

/**
 * Músicas que podem ser sugeridas: o banco já aplica publicação, categoria, momento, divergência,
 * restrição de tempo e escopo. As regras finas (Glória, salmo, texto próprio) ficam no domínio.
 */
export function listSuggestionCandidates(
  query: CandidateQuery | readonly LiturgicalMomentId[],
): Promise<SuggestionCandidate[]> {
  const normalized: CandidateQuery = Array.isArray(query) ? { moments: query } : (query as CandidateQuery);
  if (normalized.moments.length === 0) {
    return Promise.resolve([]);
  }
  return runPersistence(() =>
    CatalogSongModel.aggregate<SuggestionCandidate>([
      { $match: candidateFilter(normalized) },
      { $sort: { sortTitle: 1, id: 1 } },
      { $limit: MAX_SUGGESTION_CANDIDATES },
      { $project: CANDIDATE_PROJECTION },
    ]),
  );
}

/** Todas as músicas classificadas para os momentos, sem o filtro de tempo: para o diagnóstico. */
export function listClassifiedForMoments(moments: readonly LiturgicalMomentId[]): Promise<{ candidates: SuggestionCandidate[]; truncated: boolean }> {
  return runPersistence(async () => {
    const documents = await CatalogSongModel.aggregate<SuggestionCandidate>([
      { $match: { ...PUBLISHED, "liturgy.moments": { $in: [...moments] } } },
      { $sort: { sortTitle: 1, id: 1 } },
      { $limit: MAX_SUGGESTION_CANDIDATES + 1 },
      { $project: CANDIDATE_PROJECTION },
    ]);
    return { candidates: documents.slice(0, MAX_SUGGESTION_CANDIDATES), truncated: documents.length > MAX_SUGGESTION_CANDIDATES };
  });
}

/** Situação do catálogo publicado, para explicar por que um momento não tem sugestões. */
export interface CatalogCoverageStats {
  published: number;
  classified: number;
  /** Classificadas como canto para a missa, com ao menos um momento. */
  classifiedForMass: number;
  /** Por momento: quantas músicas publicadas estão indicadas para ele. */
  byMoment: Partial<Record<LiturgicalMomentId, number>>;
}

export function getCatalogCoverageStats(): Promise<CatalogCoverageStats> {
  return runPersistence(async () => {
    const [result] = await CatalogSongModel.aggregate<{
      published: { count: number }[];
      classified: { count: number }[];
      forMass: { count: number }[];
      byMoment: { _id: LiturgicalMomentId; count: number }[];
    }>([
      { $match: PUBLISHED },
      {
        $facet: {
          published: [{ $count: "count" }],
          classified: [{ $match: { liturgy: { $type: "object" } } }, { $count: "count" }],
          forMass: [
            { $match: { "liturgy.category": { $in: ["liturgical", "proper-text"] }, "liturgy.moments.0": { $exists: true } } },
            { $count: "count" },
          ],
          byMoment: [{ $unwind: "$liturgy.moments" }, { $group: { _id: "$liturgy.moments", count: { $sum: 1 } } }],
        },
      },
    ]);
    return {
      published: result?.published[0]?.count ?? 0,
      classified: result?.classified[0]?.count ?? 0,
      classifiedForMass: result?.forMass[0]?.count ?? 0,
      byMoment: Object.fromEntries((result?.byMoment ?? []).map((entry) => [entry._id, entry.count])),
    };
  });
}

/** Valores do vocabulário que têm ao menos uma música publicada: só classificações reais. */
export interface CatalogExploreFacets {
  moments: { id: LiturgicalMomentId; count: number }[];
  seasons: { id: LiturgicalSeasonId; count: number }[];
  celebrations: { id: LiturgicalCelebrationId; count: number }[];
  themes: { id: BiblicalThemeId; count: number }[];
}

export function getCatalogExploreFacets(): Promise<CatalogExploreFacets> {
  const facet = (field: string) => [
    { $unwind: `$liturgy.${field}` },
    { $group: { _id: `$liturgy.${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1 as const, _id: 1 as const } },
  ];
  return runPersistence(async () => {
    const [result] = await CatalogSongModel.aggregate<Record<keyof CatalogExploreFacets, { _id: string; count: number }[]>>([
      { $match: { ...PUBLISHED, liturgy: { $type: "object" } } },
      { $facet: { moments: facet("moments"), seasons: facet("seasons"), celebrations: facet("celebrations"), themes: facet("themes") } },
    ]);
    const map = (entries: { _id: string; count: number }[] = []) => entries.map((entry) => ({ id: entry._id, count: entry.count }));
    return {
      moments: map(result?.moments) as CatalogExploreFacets["moments"],
      seasons: map(result?.seasons) as CatalogExploreFacets["seasons"],
      celebrations: map(result?.celebrations) as CatalogExploreFacets["celebrations"],
      themes: map(result?.themes) as CatalogExploreFacets["themes"],
    };
  });
}

export interface CatalogQualityEntry {
  id: string;
  title: string;
  artist: string;
  status: CatalogStatus;
  readiness: Readiness;
  /** Tem cifra que pode ser exibida, se publicada. */
  hasChordPro: boolean;
  issues: QualityIssue[];
}

export const MAX_QUALITY_SONGS = 1000;

/** Situação editorial de cada música e os pontos a revisar. Só leitura: nada é alterado aqui. */
export function listCatalogQuality(): Promise<{ entries: CatalogQualityEntry[]; examined: number; truncated: boolean }> {
  return runPersistence(async () => {
    const documents = await CatalogSongModel.find({}, { searchTokens: 0, sortTitle: 0, chordPro: 0 })
      .sort({ sortTitle: 1, id: 1 })
      .limit(MAX_QUALITY_SONGS + 1)
      .lean();
    const truncated = documents.length > MAX_QUALITY_SONGS;
    const songs = documents.slice(0, MAX_QUALITY_SONGS).map(toCatalogSong);
    return {
      examined: songs.length,
      truncated,
      entries: songs.flatMap((song) => {
        const issues = assessCatalogSong(song);
        const hosted = song.contentType === "original" || song.contentType === "authorized";
        return [
          {
            id: song.id,
            title: song.title,
            artist: song.artist,
            status: song.status,
            readiness: assessReadiness(song.liturgy),
            hasChordPro: hosted && song.rights.displayChordPro,
            issues,
          },
        ];
      }),
    };
  });
}

/** Papel conferido no banco a cada operação; nunca vem do cliente nem da sessão em cache. */
export function isCatalogAdmin(userId: string): Promise<boolean> {
  return runPersistence(async () => Boolean(await CatalogAdminModel.exists({ userId })));
}

export interface CatalogAdminService {
  list(status?: CatalogStatus): Promise<CatalogSong[]>;
  get(id: string): Promise<CatalogSong>;
  create(input: CatalogSongInput): Promise<CatalogSong>;
  update(id: string, input: CatalogSongInput, expectedRevision: number): Promise<CatalogSong>;
  publish(id: string, expectedRevision: number): Promise<CatalogSong>;
  unpublish(id: string, expectedRevision: number): Promise<CatalogSong>;
  /** Grava ou remove (`null`) a classificação litúrgica. Não toca em direitos nem em status. */
  classify(id: string, input: SongClassificationInput | null, expectedRevision: number): Promise<CatalogSong>;
  /** Conferir a classificação, registrar divergência ou resolvê-la. */
  reviewClassification(id: string, request: ClassificationReviewRequest, expectedRevision: number): Promise<CatalogSong>;
}

type ValidCatalogInput = z.output<typeof catalogSongInputSchema>;

function validate(input: CatalogSongInput): ValidCatalogInput {
  const result = catalogSongInputSchema.safeParse(input);
  if (!result.success) {
    throw new LibraryError("invalid-data", result.error.issues[0]?.message);
  }
  return result.data;
}

/** Campos musicais e de identificação; o que não se aplica ao tipo de conteúdo é removido. */
function musicalFields(input: ValidCatalogInput): { set: Record<string, unknown>; unset: Record<string, 1> } {
  const { song } = input;
  const set: Record<string, unknown> = {
    title: song.title,
    artist: song.artist,
    contentType: song.contentType,
    searchTokens: buildSearchTokens(song.title, song.artist),
    sortTitle: buildSortTitle(song.title),
    metadataSources: input.metadataSources,
  };
  const unset: Record<string, 1> = {};
  const assign = (field: string, value: unknown) => {
    if (value === undefined) {
      unset[field] = 1;
    } else {
      set[field] = value;
    }
  };

  assign("originalKey", song.originalKey);
  assign("compositionReference", input.compositionReference);
  assign("sourceUrl", song.contentType === "external-link" ? song.sourceUrl : undefined);
  assign(
    "chordPro",
    song.contentType === "original" || song.contentType === "authorized" ? song.chordPro : undefined,
  );
  return { set, unset };
}

/**
 * Permissões por conteúdo. Link externo nunca tem cifra; música só com metadados não tem
 * cifra nem link. Nenhuma permissão é deduzida da classificação litúrgica.
 */
function rightsFor(input: ValidCatalogInput, adminUserId: string, now: Date): CatalogRightsDocument {
  const { contentType } = input.song;
  const hosted = contentType === "original" || contentType === "authorized";
  return {
    basis: input.rights.basis,
    evidence: input.rights.evidence,
    displayChordPro: hosted ? input.rights.displayChordPro : false,
    shareChordPro: hosted ? input.rights.shareChordPro : false,
    linkExternalSource: contentType === "external-link" ? input.rights.linkExternalSource : false,
    approvedBy: adminUserId,
    approvedAt: now,
  };
}

function sameRights(current: CatalogRightsDocument, next: CatalogRightsDocument): boolean {
  return (
    current.basis === next.basis &&
    current.evidence === next.evidence &&
    current.displayChordPro === next.displayChordPro &&
    current.shareChordPro === next.shareChordPro &&
    (current.linkExternalSource ?? true) === next.linkExternalSource
  );
}

/** Somente a administração autenticada fornece a aprovação; o cliente envia link e título. */
function videoFor(input: CatalogVideoInput, adminUserId: string, now: Date, current?: CatalogVideoDocument): CatalogVideoDocument {
  const videoId = parseYouTubeId(input.url)!;
  const title = input.title || undefined;
  if (current?.videoId === videoId && current.title === title) return current;
  const sameVideo = current?.videoId === videoId ? current : undefined;
  return {
    provider: "youtube", videoId, ...(title ? { title } : {}),
    kind: sameVideo?.kind ?? "reference",
    ...(sameVideo?.submissionId ? { submissionId: sameVideo.submissionId } : {}),
    approvedBy: adminUserId, approvedAt: now,
  };
}

/** Operações da administração. Quem chama já conferiu o papel com `isCatalogAdmin`. */
export function createCatalogAdminService(adminUserId: string): CatalogAdminService {
  async function load(id: string): Promise<Omit<CatalogSongDocument, "searchTokens" | "sortTitle">> {
    if (!isValidEntityId(id)) {
      throw new LibraryError("catalog-song-not-found");
    }
    const document = await CatalogSongModel.findOne({ id }, { searchTokens: 0, sortTitle: 0 }).lean();
    if (!document) {
      throw new LibraryError("catalog-song-not-found");
    }
    return document;
  }

  /** Revisão no filtro da própria gravação, como nas músicas particulares. */
  async function writeWithRevision(
    id: string,
    expectedRevision: number,
    update: { $set: Record<string, unknown>; $unset?: Record<string, 1> },
  ): Promise<CatalogSong> {
    const $unset = update.$unset && Object.keys(update.$unset).length > 0 ? update.$unset : undefined;
    const updated = await CatalogSongModel.findOneAndUpdate(
      { id, revision: expectedRevision },
      { $set: { ...update.$set, revision: expectedRevision + 1, updatedAt: new Date() }, ...($unset ? { $unset } : {}) },
      { returnDocument: "after", projection: { searchTokens: 0, sortTitle: 0 } },
    ).lean();

    if (!updated) {
      throw (await CatalogSongModel.exists({ id }))
        ? new LibraryError("revision-conflict")
        : new LibraryError("catalog-song-not-found");
    }
    return toCatalogSong(updated);
  }

  async function loadForWrite(id: string, expectedRevision: number) {
    assertRevision(expectedRevision);
    const current = await load(id);
    if (current.revision !== expectedRevision) {
      throw new LibraryError("revision-conflict");
    }
    return current;
  }

  return {
    list: (status) =>
      runPersistence(async () => {
        const documents = await CatalogSongModel.find(status ? { status } : {}, { searchTokens: 0, sortTitle: 0 })
          .sort({ sortTitle: 1, id: 1 })
          .limit(500)
          .lean();
        return documents.map(toCatalogSong);
      }),

    get: (id) => runPersistence(async () => toCatalogSong(await load(id))),

    // Rascunho pode nascer incompleto: título, tipo e fundamento bastam. A publicação exige mais.
    create: async (input) => {
      const data = validate(input);
      const now = new Date();
      const { set } = musicalFields(data);

      return runPersistence(async () => {
        const [created] = await CatalogSongModel.create([
          {
            ...set,
            id: createId(),
            status: "draft",
            rights: rightsFor(data, adminUserId, now),
            ...(data.video ? { video: videoFor(data.video, adminUserId, now) } : {}),
            revision: 1,
            createdAt: now,
            updatedAt: now,
          },
        ]);
        return toCatalogSong(created.toObject() as CatalogSongDocument);
      });
    },

    update: async (id, input, expectedRevision) => {
      const data = validate(input);
      return runPersistence(async () => {
        const current = await loadForWrite(id, expectedRevision);
        // Repertórios guardam o deslocamento a partir deste tom: mudá-lo mudaria a música de todos.
        // Um tom antes desconhecido pode ser informado depois, porque nenhum repertório o usou.
        if (current.publishedAt && current.originalKey && current.originalKey !== data.song.originalKey) {
          throw new LibraryError(
            "invalid-data",
            "O tom original de uma música já publicada não pode ser alterado nesta versão.",
          );
        }

        const { set, unset } = musicalFields(data);
        const rights = rightsFor(data, adminUserId, new Date());
        if (data.video === null) {
          unset.video = 1;
        } else if (data.video !== undefined) {
          set.video = videoFor(data.video, adminUserId, new Date(), current.video);
        }
        return writeWithRevision(id, expectedRevision, {
          // Direitos inalterados mantêm o registro original da aprovação.
          $set: { ...set, rights: sameRights(current.rights, rights) ? current.rights : rights },
          $unset: unset,
        });
      });
    },

    publish: async (id, expectedRevision) =>
      runPersistence(async () => {
        const current = await loadForWrite(id, expectedRevision);
        const problems = publicationProblems(toCatalogSong(current));
        if (problems.length > 0) {
          throw new LibraryError("invalid-data", problems.join(" "));
        }
        return writeWithRevision(id, expectedRevision, {
          $set: { status: "published", publishedAt: current.publishedAt ?? new Date() },
        });
      }),

    classify: async (id, input, expectedRevision) => {
      assertRevision(expectedRevision);
      if (!isValidEntityId(id)) {
        throw new LibraryError("catalog-song-not-found");
      }
      if (input === null) {
        return runPersistence(() => writeWithRevision(id, expectedRevision, { $set: {}, $unset: { liturgy: 1 } }));
      }

      const result = songClassificationInputSchema.safeParse(input);
      if (!result.success) {
        throw new LibraryError("invalid-data", result.error.issues[0]?.message);
      }
      return runPersistence(async () => {
        const current = await loadForWrite(id, expectedRevision);
        const disputed = current.liturgy?.reviewStatus === "disputed";
        // Só o campo `liturgy` muda. Uma classificação editada volta a "não conferida"; uma
        // divergência aberta continua aberta até ser resolvida.
        return writeWithRevision(id, expectedRevision, {
          $set: {
            liturgy: {
              ...result.data,
              classifiedBy: adminUserId,
              classifiedAt: new Date(),
              reviewStatus: disputed ? "disputed" : "pending_review",
              review: null,
              dispute: disputed ? current.liturgy?.dispute : null,
            },
          },
        });
      });
    },

    reviewClassification: async (id, request, expectedRevision) => {
      const parsed = classificationReviewRequestSchema.safeParse(request);
      if (!parsed.success) {
        throw new LibraryError("invalid-data", parsed.error.issues[0]?.message);
      }
      return runPersistence(async () => {
        const current = toCatalogSong(await loadForWrite(id, expectedRevision));
        if (!current.liturgy) {
          throw new LibraryError("invalid-data", "Classifique a música antes de revisar a classificação.");
        }
        const next = nextClassificationStatus(current.liturgy, parsed.data);
        if (!next.ok) {
          throw new LibraryError("invalid-data", next.message);
        }
        const now = new Date();
        const action = parsed.data;
        return writeWithRevision(id, expectedRevision, {
          $set: {
            "liturgy.reviewStatus": next.status,
            "liturgy.review": action.action === "approve" ? { by: adminUserId, at: now, source: action.source } : null,
            "liturgy.dispute": action.action === "dispute" ? { note: action.note, by: adminUserId, at: now } : null,
          },
        });
      });
    },

    // Nada é apagado: os repertórios continuam com a referência e mostram a música como indisponível.
    unpublish: async (id, expectedRevision) => {
      assertRevision(expectedRevision);
      return runPersistence(() => writeWithRevision(id, expectedRevision, { $set: { status: "unpublished" } }));
    },
  };
}

export { canShareChordPro };
