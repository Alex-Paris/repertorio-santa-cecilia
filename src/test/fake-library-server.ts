import type { FetchLike } from "@/features/library/data/remote/library-api";
import { demoSongs } from "@/features/songs/data/demo-songs";
import type { RepertoireRecord } from "@/features/repertoires/domain/repertoire";
import type { SongRecord } from "@/features/songs/domain/song";

interface Account {
  songs: SongRecord[];
  repertoires: RepertoireRecord[];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

export function apiError(status: number, code: string, message = "Falhou.", reason?: string): Response {
  return json({ error: { code, message, ...(reason ? { reason } : {}) } }, status);
}

/** API falsa, separada por conta, com controle de falhas e de ordem de resposta. */
export function createFakeLibraryServer() {
  const accounts = new Map<string, Account>();
  const requests: { userId: string; method: string; path: string }[] = [];
  let failure: (() => Response | Promise<Response>) | null = null;
  let gate: Promise<void> | null = null;

  function account(userId: string): Account {
    const existing = accounts.get(userId);
    if (existing) {
      return existing;
    }
    const created: Account = { songs: [], repertoires: [] };
    accounts.set(userId, created);
    return created;
  }

  function route(userId: string, method: string, path: string, body: unknown): Response {
    const data = account(userId);
    const songId = /^\/songs\/(.+)$/.exec(path)?.[1];

    if (path === "/songs" && method === "GET") {
      return json({ songs: data.songs.map((song) => ({ revision: 1, ...song })) });
    }
    if (path === "/repertoires" && method === "GET") {
      return json({ repertoires: data.repertoires.map((entry) => ({ revision: 1, ...entry })) });
    }
    if (path === "/songs" && method === "POST") {
      const song: SongRecord = {
        ...demoSongs[0],
        ...(body as Partial<SongRecord>),
        id: `s-${data.songs.length + 1}`,
      } as SongRecord;
      data.songs.push(song);
      return json({ song: { ...song, revision: 1 } }, 201);
    }
    if (songId && method === "DELETE") {
      data.songs = data.songs.filter((song) => song.id !== songId);
      return new Response(null, { status: 204 });
    }
    return apiError(404, "not_found", "Não encontrado.");
  }

  return {
    requests,
    account,
    /** Toda resposta passa a ser esta, até `restore`. */
    fail(next: () => Response | Promise<Response>) {
      failure = next;
    },
    restore() {
      failure = null;
    },
    /** Segura as respostas até a função retornada ser chamada. */
    hold(): () => void {
      let release: () => void = () => undefined;
      gate = new Promise((resolve) => {
        release = resolve;
      });
      return () => {
        gate = null;
        release();
      };
    },
    fetchFor(userId: string): FetchLike {
      return async (input, init) => {
        const method = init.method ?? "GET";
        const path = input.replace("/api/v1/library", "");
        requests.push({ userId, method, path });

        const heldBy = gate;
        const response = failure
          ? () => failure!()
          : () => route(userId, method, path, init.body ? JSON.parse(String(init.body)) : undefined);

        if (heldBy) {
          await heldBy;
        }
        if (init.signal?.aborted) {
          throw new DOMException("Abortado", "AbortError");
        }
        return response();
      };
    },
  };
}

export type FakeLibraryServer = ReturnType<typeof createFakeLibraryServer>;
