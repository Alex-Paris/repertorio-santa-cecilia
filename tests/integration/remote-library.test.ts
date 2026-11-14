import mongoose from "mongoose";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LIBRARY_STORAGE_KEY } from "@/features/library/data/library-storage";
import {
  createHttpRepertoireRepository,
  createHttpSongRepository,
} from "@/features/library/data/remote/http-repositories";
import { createLibraryApi, type FetchLike } from "@/features/library/data/remote/library-api";
import { readLegacyLibrary } from "@/features/library/legacy/legacy-library";
import { createRemoteLibrary, type RemoteLibrary } from "@/features/library/data/remote/remote-library";
import { createMigrationAttemptStore } from "@/features/library/migration/migration-attempts";
import { createMigrationFlow, type MigrationFlow } from "@/features/library/migration/migration-flow";
import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import { demoSongs } from "@/features/songs/data/demo-songs";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { SongModel } from "@/server/database/models/song-model";
import { describeRepositoryContract } from "@/test/repository-contract";

import { routeFetch } from "./route-fetch";
import { authRequest, clearDatabase, createTestUser, dropTestDatabase, hostedSong, type TestUser } from "./helpers";
import { latest } from "@/test/latest-revision";

function repositoriesFor(user: TestUser, fetchImpl = routeFetch(user.cookie)) {
  const api = createLibraryApi({ userId: user.id, fetchImpl });
  return { api, songs: createHttpSongRepository(api), repertoires: createHttpRepertoireRepository(api) };
}

function openRemote(user: TestUser, fetchImpl = routeFetch(user.cookie)): RemoteLibrary {
  return createRemoteLibrary({
    userId: user.id,
    fetchImpl,
    onChange: () => undefined,
    onSessionExpired: () => undefined,
    onSessionChanged: () => undefined,
  });
}

function loaded(remote: RemoteLibrary) {
  const snapshot = remote.getSnapshot();
  if (snapshot.status !== "ready") {
    throw new Error(`esperava dados carregados, obteve ${snapshot.status}`);
  }
  return snapshot.library;
}

/** Biblioteca antiga deste navegador, sobre um armazenamento em memória. */
function createBrowser() {
  const legacy = JSON.stringify({ schemaVersion: 1, songs: demoSongs, repertoires: demoRepertoires });
  const data = new Map<string, string>([[LIBRARY_STORAGE_KEY, legacy]]);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
  return { storage, raw: () => data.get(LIBRARY_STORAGE_KEY) };
}

function migrationFor(user: TestUser, browser: ReturnType<typeof createBrowser>, fetchImpl = routeFetch(user.cookie)): MigrationFlow {
  const repositories = repositoriesFor(user, fetchImpl);
  return createMigrationFlow({
    userId: user.id,
    api: repositories.api,
    attempts: createMigrationAttemptStore(user.id, () => browser.storage),
    remote: repositories,
    getLocal: () => {
      const legacy = readLegacyLibrary(() => browser.storage);
      return legacy.status === "ready" ? { status: "ready", library: legacy.library } : { status: "blocked" };
    },
    onRemoteChanged: () => undefined,
  });
}

let userA: TestUser;
let userB: TestUser;

beforeEach(async () => {
  await clearDatabase();
  userA = await createTestUser("usuaria-a");
  userB = await createTestUser("usuario-b");
});

afterEach(() => vi.restoreAllMocks());

afterAll(dropTestDatabase);

describeRepositoryContract("HTTP sobre as rotas reais", async () => {
  await clearDatabase();
  const user = await createTestUser("contrato");
  // O contrato adianta o relógio para 2030; pelas rotas reais, a sessão precisa continuar válida.
  await mongoose.connection
    .collection("session")
    .updateMany({}, { $set: { expiresAt: new Date("2100-01-01T00:00:00.000Z") } });
  const { songs, repertoires } = repositoriesFor(user);
  return { songs, repertoires };
});

describe("cenário A: migração assistida", () => {
  it("copia a biblioteca local para o MongoDB e mantém a local intacta", async () => {
    const browser = createBrowser();
    const before = browser.raw();
    const flow = migrationFor(userA, browser);

    expect(await flow.begin()).toMatchObject({
      step: "ready",
      local: { songs: demoSongs.length, repertoires: demoRepertoires.length },
      remote: { songs: 0, repertoires: 0 },
    });
    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(0);

    expect(await flow.startImport()).toMatchObject({ step: "completed", countsMatch: true });

    const stored = await SongModel.find({ ownerId: userA.id }).lean();
    expect(stored.map((song) => song.id).sort()).toEqual(demoSongs.map((song) => song.id).sort());

    const sample = stored.find((song) => song.id === demoSongs[0].id)!;
    expect(new Date(sample.createdAt).toISOString()).toBe(demoSongs[0].createdAt);

    const repertoires = await RepertoireModel.find({ ownerId: userA.id }).lean();
    expect(repertoires).toHaveLength(demoRepertoires.length);
    const songIds = new Set(demoSongs.map((song) => song.id));
    for (const repertoire of repertoires) {
      for (const item of repertoire.items) {
        expect(songIds.has(item.songId)).toBe(true);
      }
    }

    expect(browser.raw()).toBe(before);
  });

  it("recusa a cópia para uma conta preenchida, preservando as duas bibliotecas", async () => {
    await repositoriesFor(userA).songs.create(hostedSong);
    const browser = createBrowser();
    const before = browser.raw();
    const flow = migrationFor(userA, browser);

    expect(await flow.begin()).toMatchObject({ step: "conflict", remote: { songs: 1 } });
    expect(await flow.startImport()).toMatchObject({ step: "conflict" });

    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(1);
    expect(browser.raw()).toBe(before);
  });
});

describe("cenário B: isolamento entre contas", () => {
  it("a conta B não enxerga nem altera os dados da conta A", async () => {
    const remoteA = openRemote(userA);
    await remoteA.load();
    const song = await remoteA.songs.create(hostedSong);
    remoteA.dispose();

    const signOut = await authRequest("sign-out", {}, userA.cookie);
    expect(signOut.status).toBe(200);

    const remoteB = openRemote(userB);
    await remoteB.load();

    expect(loaded(remoteB).songs).toEqual([]);
    expect(await remoteB.songs.findById(song.id)).toBeNull();
    await expect(latest(remoteB).songs.update(song.id, hostedSong)).rejects.toMatchObject({ code: "song-not-found" });
    await expect(latest(remoteB).songs.delete(song.id)).rejects.toMatchObject({ code: "song-not-found" });
    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(1);
  });

  it("o cookie encerrado deixa de autorizar a biblioteca", async () => {
    const remote = openRemote(userA);
    await remote.load();
    await authRequest("sign-out", {}, userA.cookie);

    await remote.load();

    expect(remote.getSnapshot()).toEqual({ status: "remote-error", reason: "session-expired" });
    await expect(remote.songs.create(hostedSong)).rejects.toMatchObject({ code: "session-expired" });
    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(0);
  });

  it("recusa a escrita se o cookie já pertence a outra conta", async () => {
    const { songs } = repositoriesFor(userA, routeFetch(userB.cookie));

    await expect(songs.create(hostedSong)).rejects.toMatchObject({ code: "session-changed" });

    expect(await SongModel.countDocuments({ ownerId: userB.id })).toBe(0);
    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(0);
  });

  it("toda resposta é privada, inclusive as sem corpo", async () => {
    const fetchImpl = routeFetch(userA.cookie);
    const { songs } = repositoriesFor(userA);
    const song = await songs.create(hostedSong);

    const list = await fetchImpl("/api/v1/library/songs", { method: "GET" });
    const removed = await fetchImpl(`/api/v1/library/songs/${song.id}`, {
      method: "DELETE",
      headers: { "If-Match": '"1"' },
    });

    expect(list.headers.get("cache-control")).toBe("private, no-store");
    expect(removed.status).toBe(204);
    expect(removed.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("cenário C: repertório remoto", () => {
  it("persiste a música, o tom, as notas e a ordem depois de recarregar", async () => {
    const remote = openRemote(userA);
    await remote.load();

    const first = await remote.songs.create(hostedSong);
    const second = await remote.songs.create({ ...hostedSong, title: "Segunda" });
    const repertoire = await remote.repertoires.create({ name: "Show", description: "" });
    await latest(remote).repertoires.addSong(repertoire.id, first.id);
    const withBoth = await latest(remote).repertoires.addSong(repertoire.id, second.id);
    const itemId = withBoth.items[1].id;

    await latest(remote).repertoires.updateItem(repertoire.id, itemId, { transposeSemitones: 3, notes: "Entrada suave" });
    await latest(remote).repertoires.moveItem(repertoire.id, itemId, "up");
    remote.dispose();

    const reloaded = openRemote(userA);
    await reloaded.load();

    const [saved] = loaded(reloaded).repertoires;
    expect(saved.items.map((item) => item.songId)).toEqual([second.id, first.id]);
    expect(saved.items[0]).toMatchObject({ transposeSemitones: 3, notes: "Entrada suave" });
  });
});

describe("cenário D: resposta perdida (falha de rede simulada)", () => {
  /** A rota real conclui no MongoDB; só a resposta deixa de chegar ao cliente. */
  function losingImportResponse(user: TestUser): FetchLike {
    const fetchImpl = routeFetch(user.cookie);
    let lost = false;

    return async (input, init) => {
      const response = await fetchImpl(input, init);
      if (!lost && input.endsWith("/import") && init.method === "POST") {
        lost = true;
        throw new TypeError("failed to fetch");
      }
      return response;
    };
  }

  it("descobre pelo status que a cópia foi concluída, sem duplicar", async () => {
    const browser = createBrowser();
    const flow = migrationFor(userA, browser, losingImportResponse(userA));
    await flow.begin();

    expect(await flow.startImport()).toMatchObject({ step: "completed", countsMatch: true });

    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(demoSongs.length);
  });

  it("repetir com o mesmo importId não cria uma segunda cópia", async () => {
    const browser = createBrowser();
    const flow = migrationFor(userA, browser);
    await flow.begin();
    await flow.startImport();

    expect(await flow.repeat()).toMatchObject({ step: "completed", countsMatch: true });

    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(demoSongs.length);
  });

  it("recupera o resultado depois de recarregar a página", async () => {
    const browser = createBrowser();
    const flow = migrationFor(userA, browser, losingImportResponse(userA));
    await flow.begin();
    await flow.startImport();

    const reloaded = migrationFor(userA, browser);

    expect(await reloaded.begin()).toMatchObject({ step: "completed" });
  });
});
