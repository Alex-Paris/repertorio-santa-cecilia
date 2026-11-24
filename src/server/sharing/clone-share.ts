import "server-only";

import { createHash } from "node:crypto";

import { LibraryError } from "@/features/library/domain/library-errors";
import type { CloneShareRequest, CloneShareResult } from "@/features/sharing/domain/clone-share";
import { cloneShareRequestSchema } from "@/features/sharing/domain/clone-share";
import { songInputSchema } from "@/features/songs/domain/song-schema";
import { createId } from "@/lib/utils/create-id";
import { CatalogSongModel } from "@/server/database/models/catalog-song-model";
import { RepertoireModel, type RepertoireItemDocument } from "@/server/database/models/repertoire-model";
import { RepertoireShareModel } from "@/server/database/models/repertoire-share-model";
import { SongModel, type SongDocument } from "@/server/database/models/song-model";
import { toDomainRepertoire } from "@/server/repositories/document-mappers";
import { runLibraryWrite } from "@/server/repositories/library-state";

import { readPublicShareRecord } from "./public-share-reader";
import { getSharingConfig } from "./share-config";

/** Copia exclusivamente o conteúdo publicado; nunca consulta a biblioteca de quem compartilhou. */
export async function clonePublicShare(ownerId: string, request: CloneShareRequest): Promise<CloneShareResult> {
  const parsed = cloneShareRequestSchema.safeParse(request);
  if (!parsed.success) throw new LibraryError("invalid-data");
  const { token, requestId } = parsed.data;
  return runLibraryWrite(ownerId, async (session) => {
    const share = await readPublicShareRecord(token, session);
    if (!share) throw new LibraryError("share-not-found");
    const { limits } = getSharingConfig();
    if (share.snapshot.items.length > limits.itemsPerShare || Buffer.byteLength(JSON.stringify(share.snapshot)) > limits.snapshotBytes) {
      throw new LibraryError("share-limit-exceeded");
    }

    // A mesma tentativa, mesmo simultânea ou após falha de rede, nunca cria outra cópia.
    const id = createHash("sha256").update(`${ownerId}:${share.id}:${requestId}`).digest("hex");
    const existing = await RepertoireModel.findOne({ ownerId, id }).session(session).lean();
    if (existing) return { repertoire: toDomainRepertoire(existing), skippedItems: Math.max(0, share.snapshot.items.length - existing.items.length) };

    // Uma revogação ou atualização concorrente força a transação a ler o estado mais recente.
    const reserved = await RepertoireShareModel.updateOne(
      { id: share.id, status: "active", tokenVersion: share.tokenVersion, revision: share.revision },
      { $inc: { cloneVersion: 1 } },
      { session },
    );
    if (!reserved.matchedCount) throw new LibraryError("share-not-found");

    const sources = new Map(share.sources.map((source) => [source.publicItemId, source]));
    const catalogIds = share.sources.filter((source) => source.source === "catalog").map((source) => source.songId);
    const published = new Set((await CatalogSongModel.find({ id: { $in: catalogIds }, status: "published" }, { id: 1 }).session(session).lean()).map((song) => song.id));
    const now = new Date();
    const songs: SongDocument[] = [];
    const personalIds = new Map<string, string>();
    const items: RepertoireItemDocument[] = [];
    for (const item of [...share.snapshot.items].sort((a, b) => a.position - b.position)) {
      if (item.content.kind === "unavailable") continue;
      const source = sources.get(item.id);
      let songId: string;
      if (source?.source === "catalog") {
        if (!published.has(source.songId)) continue;
        songId = source.songId;
      } else {
        const input = songInputSchema.safeParse({
          title: item.title, artist: item.artist, originalKey: item.originalKey,
          ...(item.content.kind === "external-link"
            ? { contentType: "external-link", sourceUrl: item.content.sourceUrl }
            : { contentType: "authorized", ...(item.content.kind === "chordpro" ? { chordPro: item.content.chordPro } : {}) }),
        });
        // Dados antigos incompletos não recebem autoria ou tom inventados.
        if (!input.success) continue;
        const key = source?.songId ?? item.id;
        const alreadyCopied = personalIds.get(key);
        songId = alreadyCopied ?? createId();
        if (!alreadyCopied) {
          personalIds.set(key, songId);
          songs.push({ ...input.data, id: songId, ownerId, revision: 1, referenceVersion: 0, createdAt: now, updatedAt: now });
        }
      }
      items.push({
        id: createId(), songId, source: source?.source === "catalog" ? "catalog" : "personal",
        position: items.length + 1, transposeSemitones: item.transposeSemitones,
        ...(item.moment ? { moment: item.moment } : {}),
      });
    }
    if (!items.length) throw new LibraryError("invalid-data", "Nenhuma música desta publicação está disponível para copiar.");
    if (songs.length) await SongModel.insertMany(songs, { session });
    const [created] = await RepertoireModel.create([{
      id, ownerId, name: share.snapshot.name, description: share.snapshot.description,
      ...(share.snapshot.mass?.date ? { mass: { title: share.snapshot.mass.title, date: share.snapshot.mass.date } } : {}),
      items, revision: 1, createdAt: now, updatedAt: now,
    }], { session });
    return { repertoire: toDomainRepertoire(created.toObject()), skippedItems: share.snapshot.items.length - items.length };
  });
}
