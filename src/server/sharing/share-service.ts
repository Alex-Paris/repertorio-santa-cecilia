import "server-only";

import type { TransactionOptions } from "mongodb";
import type { ClientSession } from "mongoose";

import { LibraryError } from "@/features/library/domain/library-errors";
import type { Repertoire } from "@/features/repertoires/domain/repertoire";
import type {
  PublishShareInput,
  ShareAuthorizationInput,
  SharePreview,
  ShareSelection,
  ShareSummary,
  UpdateShareInput,
} from "@/features/sharing/domain/public-share";
import type { Song } from "@/features/songs/domain/song";
import {
  RepertoireShareModel,
  type RepertoireShareDocument,
  type ShareAuthorizationDocument,
} from "@/server/database/models/repertoire-share-model";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { ShareRateLimitModel } from "@/server/database/models/share-rate-limit-model";
import { canShareChordPro } from "@/features/catalog/domain/catalog-song";
import { referenceKey, resolveSongReferences, type ResolvedSong, type SongReference } from "@/server/catalog/song-resolver";
import { toDomainRepertoire } from "@/server/repositories/document-mappers";
import { ensureLibraryState, reserveLibraryState } from "@/server/repositories/library-state";
import { isValidEntityId, runPersistence, runTransaction } from "@/server/repositories/persistence";

import { getSharingConfig, type SharingConfig } from "./share-config";
import { revocationUpdate } from "./share-revocation";
import { buildShareSnapshot, hashChordPro, type BuiltShare, type CatalogShareSong } from "./share-snapshot";
import { createShareToken, generateShareId, getSharePath } from "./share-token";

/** Repertório e músicas lidos do mesmo instante, e confirmação só com gravação na maioria. */
const SHARE_TRANSACTION_OPTIONS: TransactionOptions = {
  readPreference: "primary",
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority", journal: true },
};

const HOUR_MS = 60 * 60 * 1000;
const PREVIEW_SHARE_ID = "previa";
const DUPLICATE_KEY_CODE = 11000;

export interface ShareService {
  isEnabled(): boolean;
  listForRepertoire(repertoireId: string): Promise<ShareSummary[]>;
  listAll(): Promise<ShareSummary[]>;
  preview(repertoireId: string, selection: ShareSelection): Promise<SharePreview>;
  create(repertoireId: string, input: PublishShareInput): Promise<ShareSummary>;
  previewUpdate(repertoireId: string, shareId: string, selection: ShareSelection): Promise<SharePreview>;
  update(repertoireId: string, shareId: string, input: UpdateShareInput): Promise<ShareSummary>;
  revoke(repertoireId: string, shareId: string): Promise<void>;
}

interface PrivateSource {
  repertoire: Repertoire;
  songs: Song[];
  catalog: Map<string, CatalogShareSong>;
}

function toCatalogShareSong({ song }: Extract<ResolvedSong, { source: "catalog" }>): CatalogShareSong {
  // Sem permissão para mostrar o link externo, a música entra só com metadados: o endereço não vaza.
  const shown =
    song.contentType === "external-link" && !song.rights.linkExternalSource
      ? { id: song.id, title: song.title, artist: song.artist, contentType: "metadata-only" as const }
      : song;
  return { song: shown, published: song.status === "published", canShareChordPro: canShareChordPro(song) };
}

/** Publicações de um usuário. `ownerId` vem sempre da sessão validada no servidor. */
export function createShareService(ownerId: string): ShareService {
  function requireEnabled(): SharingConfig {
    const config = getSharingConfig();
    if (!config.enabled) {
      throw new LibraryError("sharing-disabled");
    }
    return config;
  }

  /** Músicas particulares e do catálogo resolvidas em lote, cada uma pela sua origem. */
  async function resolve(
    references: readonly SongReference[],
    session?: ClientSession,
  ): Promise<{ songs: Song[]; catalog: Map<string, CatalogShareSong> }> {
    const resolved = await resolveSongReferences(references, { ownerId, session });
    const songs: Song[] = [];
    const catalog = new Map<string, CatalogShareSong>();
    for (const entry of resolved.values()) {
      if (entry.source === "personal") {
        songs.push(entry.song);
      } else {
        catalog.set(entry.song.id, toCatalogShareSong(entry));
      }
    }
    return { songs, catalog };
  }

  async function readPrivate(repertoireId: string, session?: ClientSession): Promise<PrivateSource> {
    if (!isValidEntityId(repertoireId)) {
      throw new LibraryError("repertoire-not-found");
    }

    const document = await RepertoireModel.findOne({ ownerId, id: repertoireId })
      .session(session ?? null)
      .lean();
    if (!document) {
      throw new LibraryError("repertoire-not-found");
    }

    const repertoire = toDomainRepertoire(document);
    return { repertoire, ...(await resolve(repertoire.items, session)) };
  }

  function build(
    shareId: string,
    { repertoire, songs, catalog }: PrivateSource,
    authorizations: readonly ShareAuthorizationInput[],
    { limits }: SharingConfig,
    includeMassDate = false,
  ): BuiltShare {
    if (repertoire.items.length > limits.itemsPerShare) {
      throw new LibraryError(
        "share-limit-exceeded",
        `Uma publicação pode ter no máximo ${limits.itemsPerShare} músicas.`,
      );
    }

    const built = buildShareSnapshot({
      shareId,
      repertoire,
      songs,
      catalogSongs: catalog,
      authorizedSongIds: new Set(authorizations.map((entry) => entry.songId)),
      includeMassDate,
    });

    if (Buffer.byteLength(JSON.stringify(built.snapshot)) > limits.snapshotBytes) {
      throw new LibraryError("share-limit-exceeded", "Esta publicação ficaria grande demais.");
    }
    return built;
  }

  function toAuthorizationRecords(
    authorizations: readonly ShareAuthorizationInput[],
    songs: readonly Song[],
    confirmedAt: Date,
  ): ShareAuthorizationDocument[] {
    return authorizations.flatMap(({ songId, declarationVersion }) => {
      const song = songs.find((candidate) => candidate.id === songId);
      return song?.contentType !== "external-link" && song?.chordPro
        ? [
            {
              songId,
              declarationVersion,
              confirmedAt,
              songUpdatedAt: new Date(song.updatedAt),
              chordProHash: hashChordPro(song.chordPro),
            },
          ]
        : [];
    });
  }

  /** Contador no banco: vale entre instâncias e sobrevive a reinícios. */
  async function consumeWrite({ limits }: SharingConfig): Promise<void> {
    const window = Math.floor(Date.now() / HOUR_MS);
    const expiresAt = new Date((window + 2) * HOUR_MS);

    async function increment(): Promise<number> {
      const updated = await ShareRateLimitModel.findOneAndUpdate(
        { ownerId, window },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
        { upsert: true, returnDocument: "after" },
      ).lean();
      return updated.count;
    }

    await runPersistence(async () => {
      let count: number;
      try {
        count = await increment();
      } catch (error) {
        // Duas requisições criaram o contador ao mesmo tempo: agora ele existe.
        if ((error as { code?: unknown }).code !== DUPLICATE_KEY_CODE) {
          throw error;
        }
        count = await increment();
      }
      if (count > limits.writesPerHour) {
        throw new LibraryError("share-rate-limited");
      }
    });
  }

  /**
   * Compara a publicação com a biblioteca atual. Serve para o proprietário descobrir
   * que um link ainda mostra algo que ele já alterou ou removeu.
   */
  function toSummary(
    document: RepertoireShareDocument,
    secret: string | null,
    repertoire: Repertoire | undefined,
    songs: readonly Song[],
    catalog: ReadonlyMap<string, CatalogShareSong>,
    config: SharingConfig,
  ): ShareSummary {
    const songsById = new Map(songs.map((song) => [song.id, song]));
    // Origem e ID juntos: um ID igual em outra origem é outra música.
    const currentKeys = new Set(repertoire?.items.map(referenceKey));
    const currentSongIds = new Set(
      repertoire?.items.filter((item) => item.source === "personal").map((item) => item.songId),
    );

    const removedTitles = document.sources.flatMap(({ publicItemId, songId, source = "personal" }) => {
      if (currentKeys.has(referenceKey({ source, songId }))) {
        return [];
      }
      const item = document.snapshot?.items.find((candidate) => candidate.id === publicItemId);
      return item ? [item.title] : [];
    });

    const authorizedSongIds = document.authorizations.flatMap(({ songId, chordProHash }) => {
      const song = songsById.get(songId);
      return currentSongIds.has(songId) &&
        song?.contentType !== "external-link" &&
        song?.chordPro &&
        hashChordPro(song.chordPro) === chordProHash
        ? [songId]
        : [];
    });

    return {
      id: document.id,
      repertoireId: document.repertoireId,
      name: document.name,
      revision: document.revision,
      path: secret ? getSharePath(createShareToken(secret, document.id, document.tokenVersion)) : null,
      itemCount: document.snapshot?.items.length ?? 0,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      publishedAt: document.publishedAt.toISOString(),
      authorizedSongIds,
      includeMassDate: document.includeMassDate === true,
      outdated: isOutdated(document, repertoire, songs, catalog, config),
      removedTitles,
    };
  }

  function isOutdated(
    document: RepertoireShareDocument,
    repertoire: Repertoire | undefined,
    songs: readonly Song[],
    catalog: ReadonlyMap<string, CatalogShareSong>,
    config: SharingConfig,
  ): boolean {
    if (!repertoire) {
      return true;
    }

    // Uma autorização que deixou de se aplicar também significa que algo mudou.
    const inRepertoire = new Set(
      repertoire.items.filter((item) => item.source === "personal").map((item) => item.songId),
    );
    const stillApplicable = document.authorizations.filter(({ songId }) => {
      const song = songs.find((candidate) => candidate.id === songId);
      return inRepertoire.has(songId) && song?.contentType !== "external-link" && song?.chordPro?.trim();
    });

    try {
      const { contentHash } = build(
        document.id,
        { repertoire, songs: [...songs], catalog: new Map(catalog) },
        stillApplicable.map(({ songId, declarationVersion }) => ({
          songId,
          declarationVersion: declarationVersion as ShareAuthorizationInput["declarationVersion"],
          confirmed: true as const,
        })),
        config,
        document.includeMassDate === true,
      );
      return contentHash !== document.contentHash;
    } catch {
      return true;
    }
  }

  async function summarize(documents: RepertoireShareDocument[]): Promise<ShareSummary[]> {
    const config = getSharingConfig();
    const repertoireIds = [...new Set(documents.map((document) => document.repertoireId))];

    const repertoires = (await RepertoireModel.find({ ownerId, id: { $in: repertoireIds } }).lean()).map(
      toDomainRepertoire,
    );
    const { songs, catalog } = await resolve([
      ...repertoires.flatMap((repertoire) => repertoire.items),
      ...documents.flatMap((document) =>
        document.sources.map(({ songId, source = "personal" }) => ({ songId, source })),
      ),
    ]);

    return documents.map((document) =>
      toSummary(
        document,
        config.secret,
        repertoires.find((repertoire) => repertoire.id === document.repertoireId),
        songs,
        catalog,
        config,
      ),
    );
  }

  function isValidShareId(shareId: string): boolean {
    return isValidEntityId(shareId);
  }

  return {
    isEnabled: () => getSharingConfig().enabled,

    listForRepertoire: (repertoireId) =>
      runPersistence(async () => {
        if (!isValidEntityId(repertoireId)) {
          throw new LibraryError("repertoire-not-found");
        }
        if (!(await RepertoireModel.exists({ ownerId, id: repertoireId }))) {
          throw new LibraryError("repertoire-not-found");
        }

        const documents = await RepertoireShareModel.find({ ownerId, repertoireId, status: "active" })
          .sort({ publishedAt: -1 })
          .lean<RepertoireShareDocument[]>();
        return summarize(documents);
      }),

    listAll: () =>
      runPersistence(async () => {
        const documents = await RepertoireShareModel.find({ ownerId, status: "active" })
          .sort({ publishedAt: -1 })
          .lean<RepertoireShareDocument[]>();
        return summarize(documents);
      }),

    preview: async (repertoireId, selection) => {
      const config = requireEnabled();
      return runPersistence(async () => {
        const { snapshot, contentHash } = build(
          PREVIEW_SHARE_ID,
          await readPrivate(repertoireId),
          selection.authorizations,
          config,
          selection.includeMassDate === true,
        );
        return { snapshot, contentHash };
      });
    },

    create: async (repertoireId, input) => {
      const config = requireEnabled();
      await consumeWrite(config);
      await ensureLibraryState(ownerId);

      const created = await runTransaction(async (session) => {
        // Serializa as criações do mesmo usuário: sem isso, duas poderiam passar do limite.
        await reserveLibraryState(ownerId, session);

        const source = await readPrivate(repertoireId, session);
        const userCount = await RepertoireShareModel.countDocuments({ ownerId, status: "active" }).session(session);
        const repertoireCount = await RepertoireShareModel.countDocuments({
          ownerId,
          repertoireId,
          status: "active",
        }).session(session);

        if (repertoireCount >= config.limits.linksPerRepertoire) {
          throw new LibraryError(
            "share-limit-exceeded",
            `Um repertório pode ter no máximo ${config.limits.linksPerRepertoire} links ativos.`,
          );
        }
        if (userCount >= config.limits.linksPerUser) {
          throw new LibraryError(
            "share-limit-exceeded",
            `Sua conta pode ter no máximo ${config.limits.linksPerUser} links ativos.`,
          );
        }

        const id = generateShareId();
        const built = build(id, source, input.authorizations, config, input.includeMassDate === true);
        if (built.contentHash !== input.expectedHash) {
          throw new LibraryError("share-preview-outdated");
        }

        await touchRepertoire(repertoireId, session);

        const now = new Date();
        const document: RepertoireShareDocument = {
          id,
          ownerId,
          repertoireId,
          name: built.snapshot.name,
          status: "active",
          tokenVersion: 1,
          revision: 1,
          snapshot: built.snapshot,
          contentHash: built.contentHash,
          sources: built.sources,
          authorizations: toAuthorizationRecords(input.authorizations, source.songs, now),
          ...(input.includeMassDate ? { includeMassDate: true } : {}),
          createdAt: now,
          updatedAt: now,
          publishedAt: now,
        };
        await RepertoireShareModel.create([document], { session });
        return document;
      }, SHARE_TRANSACTION_OPTIONS);

      const [summary] = await runPersistence(() => summarize([created]));
      return summary;
    },

    previewUpdate: async (repertoireId, shareId, selection) => {
      const config = requireEnabled();
      return runPersistence(async () => {
        const share = await findActive(repertoireId, shareId);
        const { snapshot, contentHash } = build(
          share.id,
          await readPrivate(repertoireId),
          selection.authorizations,
          config,
          selection.includeMassDate === true,
        );
        return { snapshot, contentHash };
      });
    },

    update: async (repertoireId, shareId, input) => {
      const config = requireEnabled();
      await consumeWrite(config);

      const updated = await runTransaction(async (session) => {
        const current = await findActive(repertoireId, shareId, session);
        if (current.revision !== input.expectedRevision) {
          throw new LibraryError("share-conflict");
        }

        const source = await readPrivate(repertoireId, session);
        const built = build(shareId, source, input.authorizations, config, input.includeMassDate === true);
        if (built.contentHash !== input.expectedHash) {
          throw new LibraryError("share-preview-outdated");
        }

        await touchRepertoire(repertoireId, session);

        const now = new Date();
        // Estado e revisão conferidos na própria gravação: uma revogação concorrente vence.
        const document = await RepertoireShareModel.findOneAndUpdate(
          { ownerId, id: shareId, repertoireId, status: "active", revision: input.expectedRevision },
          {
            $set: {
              name: built.snapshot.name,
              snapshot: built.snapshot,
              contentHash: built.contentHash,
              sources: built.sources,
              authorizations: toAuthorizationRecords(input.authorizations, source.songs, now),
              includeMassDate: input.includeMassDate === true,
              publishedAt: now,
              updatedAt: now,
            },
            $inc: { revision: 1 },
          },
          { session, returnDocument: "after" },
        ).lean<RepertoireShareDocument>();

        if (!document) {
          throw new LibraryError("share-conflict");
        }
        return document;
      }, SHARE_TRANSACTION_OPTIONS);

      const [summary] = await runPersistence(() => summarize([updated]));
      return summary;
    },

    // Não depende da flag: desligar o recurso nunca pode impedir alguém de retirar um link.
    revoke: (repertoireId, shareId) =>
      runPersistence(async () => {
        if (!isValidEntityId(repertoireId) || !isValidShareId(shareId)) {
          throw new LibraryError("share-not-found");
        }

        const { matchedCount } = await RepertoireShareModel.updateOne(
          { ownerId, id: shareId, repertoireId, status: "active" },
          revocationUpdate(new Date()),
        );
        if (matchedCount === 0) {
          throw new LibraryError("share-not-found");
        }
      }),
  };

  /** Grava no repertório para conflitar com uma exclusão ou edição simultânea. */
  async function touchRepertoire(repertoireId: string, session: ClientSession): Promise<void> {
    await RepertoireModel.updateOne(
      { ownerId, id: repertoireId },
      { $inc: { shareVersion: 1 } },
      { session },
    );
  }

  async function findActive(
    repertoireId: string,
    shareId: string,
    session?: ClientSession,
  ): Promise<RepertoireShareDocument> {
    if (!isValidEntityId(repertoireId) || !isValidEntityId(shareId)) {
      throw new LibraryError("share-not-found");
    }

    const share = await RepertoireShareModel.findOne({ ownerId, id: shareId, repertoireId })
      .session(session ?? null)
      .lean<RepertoireShareDocument>();

    if (!share) {
      throw new LibraryError("share-not-found");
    }
    if (share.status !== "active") {
      // Uma atualização antiga nunca reativa um link revogado.
      throw new LibraryError("share-conflict", "Esta publicação foi revogada e não pode ser atualizada.");
    }
    return share;
  }
}
