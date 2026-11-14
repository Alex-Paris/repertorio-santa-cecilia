import { z } from "zod";

import type { RepertoireRepository } from "@/features/repertoires/data/repertoire-repository";
import { repertoireSchema } from "@/features/repertoires/domain/repertoire-schema";
import type { SongRepository } from "@/features/songs/data/song-repository";
import { songSchema } from "@/features/songs/domain/song-schema";

import { LibraryError, type LibraryErrorCode } from "../../domain/library-errors";
import type { LibraryApi } from "./library-api";

const songResponse = z.object({ song: songSchema });
const songsResponse = z.object({ songs: z.array(songSchema) });
const repertoireResponse = z.object({ repertoire: repertoireSchema });
const repertoiresResponse = z.object({ repertoires: z.array(repertoireSchema) });

function segment(id: string): string {
  return encodeURIComponent(id);
}

async function nullWhenMissing<T>(
  request: Promise<T>,
  missing: LibraryErrorCode,
): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof LibraryError && error.code === missing) {
      return null;
    }
    throw error;
  }
}

/** Implementa o contrato por HTTP. As regras de negócio continuam todas no servidor. */
export function createHttpSongRepository(api: LibraryApi): SongRepository {
  async function list() {
    return (await api.request("/songs", songsResponse)).songs;
  }

  return {
    list,

    async findById(id) {
      const body = await nullWhenMissing(
        api.request(`/songs/${segment(id)}`, songResponse),
        "song-not-found",
      );
      return body?.song ?? null;
    },

    // Não há rota em lote: uma única listagem atende a qualquer quantidade de IDs.
    async findByIds(ids) {
      const byId = new Map((await list()).map((song) => [song.id, song]));
      return ids.flatMap((id) => byId.get(id) ?? []);
    },

    async create(input) {
      return (await api.request("/songs", songResponse, { method: "POST", body: input })).song;
    },

    async update(id, input, expectedRevision) {
      return (
        await api.request(`/songs/${segment(id)}`, songResponse, {
          method: "PUT",
          body: input,
          ifMatch: expectedRevision,
        })
      ).song;
    },

    async delete(id, expectedRevision) {
      await api.send(`/songs/${segment(id)}`, { method: "DELETE", ifMatch: expectedRevision });
    },
  };
}

export function createHttpRepertoireRepository(api: LibraryApi): RepertoireRepository {
  function itemPath(id: string, itemId: string): string {
    return `/repertoires/${segment(id)}/items/${segment(itemId)}`;
  }

  return {
    async list() {
      return (await api.request("/repertoires", repertoiresResponse)).repertoires;
    },

    async findById(id) {
      const body = await nullWhenMissing(
        api.request(`/repertoires/${segment(id)}`, repertoireResponse),
        "repertoire-not-found",
      );
      return body?.repertoire ?? null;
    },

    async create(input) {
      return (await api.request("/repertoires", repertoireResponse, { method: "POST", body: input }))
        .repertoire;
    },

    async update(id, input, expectedRevision) {
      return (
        await api.request(`/repertoires/${segment(id)}`, repertoireResponse, {
          method: "PUT",
          body: input,
          ifMatch: expectedRevision,
        })
      ).repertoire;
    },

    async delete(id, expectedRevision) {
      await api.send(`/repertoires/${segment(id)}`, { method: "DELETE", ifMatch: expectedRevision });
    },

    async addSong(id, songId, expectedRevision, source = "personal", moment) {
      return (
        await api.request(`/repertoires/${segment(id)}/items`, repertoireResponse, {
          method: "POST",
          body: { songId, source, ...(moment ? { moment } : {}) },
          ifMatch: expectedRevision,
        })
      ).repertoire;
    },

    async removeItem(id, itemId, expectedRevision) {
      return (
        await api.request(itemPath(id, itemId), repertoireResponse, {
          method: "DELETE",
          ifMatch: expectedRevision,
        })
      ).repertoire;
    },

    async moveItem(id, itemId, direction, expectedRevision) {
      return (
        await api.request(`${itemPath(id, itemId)}/move`, repertoireResponse, {
          method: "POST",
          body: { direction },
          ifMatch: expectedRevision,
        })
      ).repertoire;
    },

    async updateItem(id, itemId, changes, expectedRevision) {
      return (
        await api.request(itemPath(id, itemId), repertoireResponse, {
          method: "PATCH",
          body: changes,
          ifMatch: expectedRevision,
        })
      ).repertoire;
    },
  };
}
