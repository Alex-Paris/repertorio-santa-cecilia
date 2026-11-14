import { vi } from "vitest";

import type { CatalogSongView, Library, LibraryRecord } from "@/features/library/domain/library";
import { LibraryError } from "@/features/library/domain/library-errors";
import { createLibraryBackup } from "@/features/library/services/library-backup";
import { toErrorResponse, jsonResponse } from "@/server/http/api-error";
import { readJsonBody } from "@/server/http/read-json-body";
import { z } from "zod";

import { createFakeRepertoireRepository } from "./fakes/fake-repertoire-repository";
import { createFakeSongRepository } from "./fakes/fake-song-repository";
import { createMemoryLibraryStore, type LibraryStore } from "./fakes/memory-library-store";

const anyBody = z.any();

interface Account {
  store: LibraryStore;
  songs: ReturnType<typeof createFakeSongRepository>;
  repertoires: ReturnType<typeof createFakeRepertoireRepository>;
}

function createAccount(library: LibraryRecord, catalog: () => CatalogSongView[]): Account {
  const store = createMemoryLibraryStore(library);
  return {
    store,
    songs: createFakeSongRepository(store),
    repertoires: createFakeRepertoireRepository(store, (songId) => catalog().some((song) => song.id === songId)),
  };
}

/**
 * API privada falsa para os testes de interface. As respostas passam pelos mesmos
 * adaptadores HTTP da aplicação, com o mesmo formato de erro do servidor real.
 */
function createFakeAccountApi() {
  const accounts = new Map<string, Account>();
  /** Músicas publicadas do catálogo falso, iguais para todas as contas. */
  let catalog: CatalogSongView[] = [];
  const getCatalog = () => catalog;
  let userId: string | null = null;
  let failure: (() => Response) | null = null;

  async function listRepertoires(account: Account) {
    const repertoires = await account.repertoires.list();
    const used = new Set(
      repertoires.flatMap((repertoire) =>
        repertoire.items.filter((item) => item.source === "catalog").map((item) => item.songId),
      ),
    );
    return { repertoires, catalogSongs: catalog.filter((song) => used.has(song.id)) };
  }

  async function route(account: Account, method: string, path: string, init: RequestInit): Promise<Response> {
    const body = async (): Promise<never> =>
      (await readJsonBody(
        new Request("http://fake", { method: "POST", headers: { "content-type": "application/json" }, body: init.body }),
        anyBody,
      )) as never;

    const [, resource, id, sub, itemId, action] = path.split("/");
    // Mesmo contrato do servidor: a revisão esperada vem em If-Match, como "3".
    const ifMatch = /^"(\d+)"$/.exec(new Headers(init.headers).get("if-match") ?? "");
    const revision = ifMatch ? Number(ifMatch[1]) : undefined;
    const expected = (): number => {
      if (revision === undefined) {
        throw new LibraryError("revision-required");
      }
      return revision;
    };

    if (resource === "export" && method === "GET") {
      return jsonResponse({ backup: createLibraryBackup(account.store.read(), new Date()) });
    }

    if (resource === "songs") {
      if (!id) {
        return method === "GET"
          ? jsonResponse({ songs: await account.songs.list() })
          : jsonResponse({ song: await account.songs.create(await body()) }, 201);
      }
      if (method === "GET") {
        const song = await account.songs.findById(id);
        if (!song) {
          throw new LibraryError("song-not-found");
        }
        return jsonResponse({ song });
      }
      if (method === "PUT") {
        return jsonResponse({ song: await account.songs.update(id, await body(), expected()) });
      }
      await account.songs.delete(id, expected());
      return new Response(null, { status: 204 });
    }

    if (resource === "repertoires") {
      if (!id) {
        return method === "GET"
          ? jsonResponse(await listRepertoires(account))
          : jsonResponse({ repertoire: await account.repertoires.create(await body()) }, 201);
      }
      if (sub === "items") {
        if (!itemId) {
          const { songId, source, moment } = await body() as { songId: string; source?: "catalog" | "personal"; moment?: never };
          return jsonResponse({ repertoire: await account.repertoires.addSong(id, songId, expected(), source, moment) }, 201);
        }
        if (action === "move") {
          const { direction } = await body() as { direction: "up" | "down" };
          return jsonResponse({ repertoire: await account.repertoires.moveItem(id, itemId, direction, expected()) });
        }
        return method === "PATCH"
          ? jsonResponse({ repertoire: await account.repertoires.updateItem(id, itemId, await body(), expected()) })
          : jsonResponse({ repertoire: await account.repertoires.removeItem(id, itemId, expected()) });
      }
      if (method === "GET") {
        const repertoire = await account.repertoires.findById(id);
        if (!repertoire) {
          throw new LibraryError("repertoire-not-found");
        }
        return jsonResponse({ repertoire });
      }
      if (method === "PUT") {
        return jsonResponse({ repertoire: await account.repertoires.update(id, await body(), expected()) });
      }
      await account.repertoires.delete(id, expected());
      return new Response(null, { status: 204 });
    }

    return new Response(JSON.stringify({ error: { code: "not_found", message: "Não encontrado." } }), { status: 404 });
  }

  return {
    reset(): void {
      accounts.clear();
      catalog = [];
      userId = null;
      failure = null;
    },
    /** Define quem está autenticado e, se informado, o conteúdo da conta. */
    signIn(id: string, library?: LibraryRecord): void {
      if (library || !accounts.has(id)) {
        accounts.set(id, createAccount(library ?? { songs: [], repertoires: [] }, getCatalog));
      }
      userId = id;
    },
    /** Músicas publicadas do catálogo, para os testes que o usam. */
    setCatalog(songs: CatalogSongView[]): void {
      catalog = songs;
    },
    signOut(): void {
      userId = null;
    },
    /** Acesso direto à conta, como se fosse outro dispositivo alterando os dados. */
    otherDevice(id = userId): { songs: Account["songs"]; repertoires: Account["repertoires"] } {
      const account = id ? accounts.get(id) : undefined;
      if (!account) {
        throw new Error("conta inexistente");
      }
      return { songs: account.songs, repertoires: account.repertoires };
    },
    fail(next: (() => Response) | null): void {
      failure = next;
    },
    library(id = userId): Library {
      const account = id ? accounts.get(id) : undefined;
      if (!account) {
        throw new Error("conta inexistente");
      }
      return account.store.read();
    },

    fetch: vi.fn(async (input: string, init: RequestInit = {}): Promise<Response> => {
      const path = String(input).replace("/api/v1/library", "");
      const method = init.method ?? "GET";

      if (failure) {
        return failure();
      }
      // Leitura pública do catálogo: sem sessão.
      const single = /^\/api\/v1\/catalog\/songs\/([^/?]+)$/.exec(String(input));
      if (single) {
        const song = catalog.find((candidate) => candidate.id === decodeURIComponent(single[1]));
        return song ? jsonResponse({ song }) : jsonResponse({ error: { code: "not_found", message: "Não encontrada." } }, 404);
      }
      if (String(input).startsWith("/api/v1/catalog/songs")) {
        const query = new URL(String(input), "http://fake").searchParams.get("q")?.toLowerCase() ?? "";
        const songs = catalog
          .filter((song) => `${song.title} ${song.artist}`.toLowerCase().includes(query))
          .map(({ id, title, artist, originalKey, contentType, chordProAvailable }) => ({
            id, title, artist, originalKey, contentType, hasChordPro: chordProAvailable,
          }));
        return jsonResponse({ songs, page: 1, pageSize: 12, total: songs.length, totalPages: songs.length ? 1 : 0 });
      }
      if (!userId) {
        return new Response(JSON.stringify({ error: { code: "unauthenticated", message: "Entre." } }), { status: 401 });
      }
      if (new Headers(init.headers).get("x-repertorio-expected-user") !== userId) {
        return new Response(JSON.stringify({ error: { code: "session_changed", message: "Mudou." } }), { status: 409 });
      }

      try {
        return await route(accounts.get(userId)!, method, path, init);
      } catch (error) {
        return toErrorResponse(error);
      }
    }),

    authClient: {
      getSession: vi.fn(async () => ({
        data: userId ? { user: { id: userId, email: `${userId}@exemplo.test` } } : null,
        error: null,
      })),
    },
  };
}

export const fakeAccount = createFakeAccountApi();
