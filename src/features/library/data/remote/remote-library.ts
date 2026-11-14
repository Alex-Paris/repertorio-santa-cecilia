import { z } from "zod";

import type { RepertoireRepository } from "@/features/repertoires/data/repertoire-repository";
import type { Repertoire } from "@/features/repertoires/domain/repertoire";
import { repertoireSchema } from "@/features/repertoires/domain/repertoire-schema";
import type { SongRepository } from "@/features/songs/data/song-repository";
import type { Song } from "@/features/songs/domain/song";
import { songSchema } from "@/features/songs/domain/song-schema";
import { catalogSongViewSchema, type CatalogSongView } from "@/features/catalog/domain/catalog-song";

import type { Library } from "../../domain/library";
import { LibraryError } from "../../domain/library-errors";
import { createHttpRepertoireRepository, createHttpSongRepository } from "./http-repositories";
import { createLibraryApi, type FetchLike } from "./library-api";

export type RemoteErrorReason = "unavailable" | "session-expired" | "invalid-response";

export type RemoteLibrarySnapshot =
  | { status: "loading" }
  | { status: "ready"; library: Library; stale: boolean }
  | { status: "remote-error"; reason: RemoteErrorReason };

export interface RemoteLibraryCallbacks {
  onChange: () => void;
  /** A sessão terminou: os dados já foram descartados desta instância. */
  onSessionExpired: () => void;
  /** Outra conta assumiu este navegador. */
  onSessionChanged: () => void;
}

export interface RemoteLibrary {
  userId: string;
  songs: SongRepository;
  repertoires: RepertoireRepository;
  getSnapshot(): RemoteLibrarySnapshot;
  load(options?: { background?: boolean }): Promise<void>;
  /** A sessão acabou: descarta os dados e bloqueia novas operações. */
  expire(): void;
  /** Encerra a instância: respostas que ainda chegarem são ignoradas. */
  dispose(): void;
}

const LOADING: RemoteLibrarySnapshot = { status: "loading" };

const songsResponse = z.object({ songs: z.array(songSchema) });
// Respostas antigas não traziam o catálogo: valem como lista vazia.
const repertoiresResponse = z.object({
  repertoires: z.array(repertoireSchema),
  catalogSongs: z.array(catalogSongViewSchema).optional().default([]),
});

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function upsert<T extends { id: string }>(items: readonly T[], item: T): T[] {
  return items.some((candidate) => candidate.id === item.id)
    ? items.map((candidate) => (candidate.id === item.id ? item : candidate))
    : [...items, item];
}

/**
 * Estado remoto de um único usuário. Cada login cria uma nova instância, e os dados
 * nunca saem dela: nenhuma resposta de uma conta alcança o estado de outra.
 */
export function createRemoteLibrary({
  userId,
  fetchImpl,
  onChange,
  onSessionExpired,
  onSessionChanged,
}: RemoteLibraryCallbacks & { userId: string; fetchImpl?: FetchLike }): RemoteLibrary {
  const api = createLibraryApi({ userId, fetchImpl });
  const httpSongs = createHttpSongRepository(api);
  const httpRepertoires = createHttpRepertoireRepository(api);

  let snapshot = LOADING;
  let disposed = false;
  let loadGeneration = 0;
  let loadController: AbortController | null = null;
  let pendingMutations = 0;

  function publish(next: RemoteLibrarySnapshot): void {
    snapshot = next;
    onChange();
  }

  function cancelLoad(): void {
    loadGeneration += 1;
    loadController?.abort();
    loadController = null;
  }

  function expireSession(): void {
    cancelLoad();
    snapshot = { status: "remote-error", reason: "session-expired" };
    // Primeiro o aviso: quem renderiza precisa saber que há um rascunho a preservar.
    onSessionExpired();
    onChange();
  }

  function assertUsable(): void {
    if (disposed) {
      throw new LibraryError("session-changed");
    }
    if (snapshot.status === "remote-error" && snapshot.reason === "session-expired") {
      throw new LibraryError("session-expired");
    }
  }

  /** Reações comuns a qualquer falha. Retorna verdadeiro quando a sessão deixou de valer. */
  function handleSessionFailure(error: unknown): boolean {
    if (disposed || !(error instanceof LibraryError)) {
      return disposed;
    }
    if (error.code === "session-expired") {
      expireSession();
      return true;
    }
    if (error.code === "session-changed") {
      onSessionChanged();
      return true;
    }
    return false;
  }

  async function load({ background = false }: { background?: boolean } = {}): Promise<void> {
    if (disposed || pendingMutations > 0) {
      return;
    }

    cancelLoad();
    const generation = loadGeneration;
    const controller = new AbortController();
    loadController = controller;

    if (!background || snapshot.status !== "ready") {
      publish(LOADING);
    }

    try {
      const [songs, repertoires] = await Promise.all([
        api.request("/songs", songsResponse, { signal: controller.signal }),
        api.request("/repertoires", repertoiresResponse, { signal: controller.signal }),
      ]);

      if (disposed || generation !== loadGeneration) {
        return;
      }

      publish({
        status: "ready",
        stale: false,
        library: deepFreeze({
          songs: songs.songs,
          repertoires: repertoires.repertoires,
          catalogSongs: repertoires.catalogSongs,
        }),
      });
    } catch (error) {
      if (disposed || generation !== loadGeneration || handleSessionFailure(error)) {
        return;
      }
      if (error instanceof LibraryError && error.code === "request-cancelled") {
        return;
      }

      if (background && snapshot.status === "ready") {
        // A última leitura confirmada continua na tela, com o aviso de que pode estar antiga.
        publish({ ...snapshot, stale: true });
        return;
      }

      publish({
        status: "remote-error",
        reason:
          error instanceof LibraryError && error.code === "invalid-response"
            ? "invalid-response"
            : "unavailable",
      });
    }
  }

  /** Gravações do mesmo documento, nesta aba, em fila: nunca duas com a mesma revisão. */
  const queues = new Map<string, Promise<unknown>>();
  /** Revisões que esta aba mesma produziu em itens: revisão anterior → revisão resultante. */
  const ownAdvances = new Map<string, Map<number, number>>();

  function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const run = (queues.get(key) ?? Promise.resolve()).then(task, task);
    queues.set(
      key,
      run.catch(() => undefined),
    );
    return run;
  }

  /**
   * Uma alteração de item feita logo depois de outra, nesta aba, ainda vê a revisão anterior.
   * Ela segue sobre a revisão que esta aba mesma produziu. Alterações de outro dispositivo
   * nunca entram nessa cadeia e continuam gerando conflito.
   */
  function rebase(key: string, expected: number): number {
    const advances = ownAdvances.get(key);
    let revision = expected;
    while (advances?.has(revision)) {
      revision = advances.get(revision) as number;
    }
    return revision;
  }

  function recordAdvance(key: string, from: number, to: number): void {
    const advances = ownAdvances.get(key) ?? new Map<number, number>();
    advances.set(from, to);
    ownAdvances.set(key, advances);
  }

  /** Sucesso só depois da resposta da API, que também define o novo estado em tela. */
  async function mutate<T>(
    operation: () => Promise<T>,
    apply: (library: Library, result: T) => Library,
  ): Promise<T> {
    assertUsable();
    pendingMutations += 1;
    cancelLoad();

    try {
      const result = await operation();

      if (!disposed && snapshot.status === "ready") {
        publish({
          ...snapshot,
          library: deepFreeze(apply(snapshot.library, structuredClone(result))),
        });
      }
      return result;
    } catch (error) {
      if (handleSessionFailure(error)) {
        throw error;
      }
      if (error instanceof LibraryError && error.code === "remote-unavailable") {
        // Sem resposta não há como saber se o servidor concluiu a operação.
        throw new LibraryError("write-uncertain");
      }
      throw error;
    } finally {
      pendingMutations -= 1;
      if (pendingMutations === 0) {
        void load({ background: true });
      }
    }
  }

  /** Alteração de documento inteiro: usa exatamente a revisão que a tela carregou. */
  function mutateDocument<T>(
    key: string,
    operation: () => Promise<T>,
    apply: (library: Library, result: T) => Library,
  ): Promise<T> {
    assertUsable();
    return enqueue(key, () => mutate(operation, apply));
  }

  /** Alteração de item: em fila e sobre as revisões produzidas por esta aba. */
  function mutateItems(
    id: string,
    expected: number,
    operation: (revision: number) => Promise<Repertoire>,
    apply: (library: Library, repertoire: Repertoire) => Library = applyRepertoire,
  ): Promise<Repertoire> {
    assertUsable();
    const key = `repertoire:${id}`;
    return enqueue(key, async () => {
      const revision = rebase(key, expected);
      const result = await mutate(() => operation(revision), apply);
      recordAdvance(key, revision, result.revision);
      return result;
    });
  }

  async function read<T>(operation: () => Promise<T>): Promise<T> {
    assertUsable();
    try {
      return await operation();
    } catch (error) {
      handleSessionFailure(error);
      throw error;
    }
  }

  /**
   * Leitura pública da música recém-adicionada do catálogo, para a tela não mostrar o item
   * como indisponível até a próxima recarga. Se falhar, a recarga em seguida resolve.
   */
  async function readCatalogSong(songId: string): Promise<CatalogSongView | null> {
    try {
      const response = await (fetchImpl ?? ((input, init) => fetch(input, init)))(
        `/api/v1/catalog/songs/${encodeURIComponent(songId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        return null;
      }
      const parsed = z.object({ song: catalogSongViewSchema }).safeParse(await response.json());
      return parsed.success ? parsed.data.song : null;
    } catch {
      return null;
    }
  }

  function applySong(library: Library, song: Song): Library {
    return { ...library, songs: upsert(library.songs, song) };
  }

  function applyRepertoire(library: Library, repertoire: Repertoire): Library {
    return { ...library, repertoires: upsert(library.repertoires, repertoire) };
  }

  return {
    userId,
    getSnapshot: () => snapshot,
    load,

    expire() {
      if (!disposed) {
        expireSession();
      }
    },

    dispose() {
      disposed = true;
      cancelLoad();
      ownAdvances.clear();
      snapshot = LOADING;
    },

    songs: {
      list: () => read(() => httpSongs.list()),
      findById: (id) => read(() => httpSongs.findById(id)),
      findByIds: (ids) => read(() => httpSongs.findByIds(ids)),
      create: (input) => mutate(() => httpSongs.create(input), applySong),
      update: (id, input, revision) =>
        mutateDocument(`song:${id}`, () => httpSongs.update(id, input, revision), applySong),
      delete: (id, revision) =>
        mutateDocument(
          `song:${id}`,
          () => httpSongs.delete(id, revision),
          (library) => ({ ...library, songs: library.songs.filter((song) => song.id !== id) }),
        ),
    },

    repertoires: {
      list: () => read(() => httpRepertoires.list()),
      findById: (id) => read(() => httpRepertoires.findById(id)),
      create: (input) => mutate(() => httpRepertoires.create(input), applyRepertoire),
      update: (id, input, revision) =>
        mutateDocument(
          `repertoire:${id}`,
          () => httpRepertoires.update(id, input, revision),
          applyRepertoire,
        ),
      delete: (id, revision) =>
        mutateDocument(
          `repertoire:${id}`,
          () => httpRepertoires.delete(id, revision),
          (library) => ({
            ...library,
            repertoires: library.repertoires.filter((repertoire) => repertoire.id !== id),
          }),
        ),
      addSong: (id, songId, revision, source, moment) => {
        let added: CatalogSongView | null = null;
        return mutateItems(
          id,
          revision,
          async (current) => {
            const repertoire = await httpRepertoires.addSong(id, songId, current, source, moment);
            if (source === "catalog") {
              added = await readCatalogSong(songId);
            }
            return repertoire;
          },
          (library, repertoire) =>
            applyRepertoire(
              added ? { ...library, catalogSongs: upsert(library.catalogSongs, added) } : library,
              repertoire,
            ),
        );
      },
      removeItem: (id, itemId, revision) =>
        mutateItems(id, revision, (current) => httpRepertoires.removeItem(id, itemId, current)),
      moveItem: (id, itemId, direction, revision) =>
        mutateItems(id, revision, (current) =>
          httpRepertoires.moveItem(id, itemId, direction, current),
        ),
      updateItem: (id, itemId, changes, revision) =>
        mutateItems(id, revision, (current) =>
          httpRepertoires.updateItem(id, itemId, changes, current),
        ),
    },
  };
}
