import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as exportRoute from "@/app/api/v1/library/export/route";
import * as importRoute from "@/app/api/v1/library/import/route";
import * as publicRoute from "@/app/api/v1/public/shares/[token]/route";
import { LIBRARY_STORAGE_KEY } from "@/features/library/data/library-storage";
import {
  createHttpRepertoireRepository,
  createHttpSongRepository,
} from "@/features/library/data/remote/http-repositories";
import { fetchAccountBackup } from "@/features/library/data/remote/backup-api";
import { createLibraryApi } from "@/features/library/data/remote/library-api";
import { createRemoteLibrary, type RemoteLibrary } from "@/features/library/data/remote/remote-library";
import { readLegacyLibrary } from "@/features/library/legacy/legacy-library";
import { createMigrationAttemptStore } from "@/features/library/migration/migration-attempts";
import { createMigrationFlow } from "@/features/library/migration/migration-flow";
import { createLibraryBackup, parseLibraryBackupDocument } from "@/features/library/services/library-backup";
import { RIGHTS_DECLARATION_VERSION, type ShareSelection } from "@/features/sharing/domain/public-share";
import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import { demoSongs } from "@/features/songs/data/demo-songs";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { SongModel } from "@/server/database/models/song-model";
import { createLibraryService } from "@/server/library/library-service";

import {
  authRequest,
  clearDatabase,
  createTestUser,
  dropTestDatabase,
  getCookieHeader,
  hostedSong,
  ORIGIN,
  type TestUser,
} from "./helpers";
import { routeFetch } from "./route-fetch";
import { latest } from "@/test/latest-revision";

const SECRET = "chave-de-integracao-com-mais-de-32-caracteres";
const hosted = {
  title: hostedSong.title,
  artist: hostedSong.artist,
  originalKey: hostedSong.originalKey,
  contentType: "original" as const,
  chordPro: "[G]Texto",
};

let userA: TestUser;
let userB: TestUser;

beforeEach(async () => {
  vi.stubEnv("PUBLIC_SHARING_ENABLED", "true");
  vi.stubEnv("SHARE_LINK_SECRET", SECRET);
  await clearDatabase();
  userA = await createTestUser("usuaria-a");
  userB = await createTestUser("usuario-b");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(dropTestDatabase);

function open(user: TestUser, cookie = user.cookie): RemoteLibrary {
  return createRemoteLibrary({
    userId: user.id,
    fetchImpl: routeFetch(cookie),
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

/** Biblioteca antiga em um navegador simulado. */
function legacyBrowser() {
  const raw = JSON.stringify({ schemaVersion: 1, songs: demoSongs, repertoires: demoRepertoires });
  const data = new Map<string, string>([[LIBRARY_STORAGE_KEY, raw]]);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
  return { raw, storage, current: () => data.get(LIBRARY_STORAGE_KEY) };
}

function migrationFor(user: TestUser, browser: ReturnType<typeof legacyBrowser>) {
  const api = createLibraryApi({ userId: user.id, fetchImpl: routeFetch(user.cookie) });
  return createMigrationFlow({
    userId: user.id,
    api,
    attempts: createMigrationAttemptStore(user.id, () => browser.storage),
    remote: { songs: createHttpSongRepository(api), repertoires: createHttpRepertoireRepository(api) },
    getLocal: () => {
      const legacy = readLegacyLibrary(() => browser.storage);
      return legacy.status === "ready" ? { status: "ready", library: legacy.library } : { status: "blocked" };
    },
    onRemoteChanged: () => undefined,
  });
}

async function signInAgain(user: TestUser): Promise<string> {
  const response = await authRequest("sign-in/email", { email: user.email, password: user.password });
  expect(response.status).toBe(200);
  return getCookieHeader(response);
}

describe("A: conta nova", () => {
  it("começa vazia e persiste o que é criado", async () => {
    const remote = open(userA);
    await remote.load();
    expect(loaded(remote)).toEqual({ songs: [], repertoires: [], catalogSongs: [] });

    const song = await remote.songs.create(hosted);
    const repertoire = await remote.repertoires.create({ name: "Show", description: "" });
    remote.dispose();

    const reloaded = open(userA);
    await reloaded.load();

    expect(loaded(reloaded).songs.map((entry) => entry.id)).toEqual([song.id]);
    expect(loaded(reloaded).repertoires.map((entry) => entry.id)).toEqual([repertoire.id]);
  });

  it("não cria exemplos no banco", async () => {
    const remote = open(userA);
    await remote.load();

    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(0);
    expect(await RepertoireModel.countDocuments({ ownerId: userA.id })).toBe(0);
  });
});

describe("B: conta existente", () => {
  it("entra de novo, altera cifra e repertório, e o banco reflete", async () => {
    const first = open(userA);
    await first.load();
    const song = await first.songs.create(hosted);
    const repertoire = await first.repertoires.create({ name: "Show", description: "" });
    await latest(first).repertoires.addSong(repertoire.id, song.id);
    first.dispose();

    const remote = open(userA, await signInAgain(userA));
    await remote.load();
    expect(loaded(remote).songs).toHaveLength(1);

    await latest(remote).songs.update(song.id, { ...hosted, chordPro: "[A]Editada" });
    await latest(remote).repertoires.update(repertoire.id, { name: "Renomeado", description: "Novo" });

    const storedSong = await SongModel.findOne({ ownerId: userA.id, id: song.id }).lean();
    const storedRepertoire = await RepertoireModel.findOne({ ownerId: userA.id, id: repertoire.id }).lean();
    expect(storedSong?.chordPro).toBe("[A]Editada");
    expect(storedRepertoire).toMatchObject({ name: "Renomeado", description: "Novo" });
  });
});

describe("C: dados locais antigos", () => {
  it("entrar não importa; a importação é explícita e mantém os dados locais", async () => {
    const browser = legacyBrowser();

    const remote = open(userA);
    await remote.load();
    expect(loaded(remote).songs).toEqual([]);
    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(0);
    expect(browser.current()).toBe(browser.raw);

    const legacy = readLegacyLibrary(() => browser.storage);
    expect(legacy).toMatchObject({ status: "ready" });
    if (legacy.status === "ready") {
      expect(parseLibraryBackupDocument(JSON.parse(JSON.stringify(createLibraryBackup(legacy.library, new Date()))))).toMatchObject({
        status: "ok",
      });
    }

    const flow = migrationFor(userA, browser);
    expect(await flow.begin()).toMatchObject({ step: "ready" });
    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(0);

    expect(await flow.startImport()).toMatchObject({ step: "completed", countsMatch: true });

    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(demoSongs.length);
    expect(browser.current()).toBe(browser.raw);
  });

  it("repetir com o mesmo importId não duplica", async () => {
    const browser = legacyBrowser();
    const flow = migrationFor(userA, browser);
    await flow.begin();
    await flow.startImport();

    expect(await flow.repeat()).toMatchObject({ step: "completed" });

    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(demoSongs.length);
  });
});

describe("D: conflito", () => {
  it("recusa com 409 e preserva as duas bibliotecas", async () => {
    const remote = open(userA);
    await remote.load();
    await remote.songs.create(hosted);
    const browser = legacyBrowser();
    const flow = migrationFor(userA, browser);

    expect(await flow.begin()).toMatchObject({ step: "conflict", remote: { songs: 1 } });

    const response = await importRoute.POST(
      new Request(`${ORIGIN}/api/v1/library/import`, {
        method: "POST",
        headers: { cookie: userA.cookie, origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({
          importId: crypto.randomUUID(),
          backup: { schemaVersion: 1, exportedAt: new Date().toISOString(), songs: demoSongs, repertoires: demoRepertoires },
        }),
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(409);
    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(1);
    expect(browser.current()).toBe(browser.raw);
  });
});

describe("E: isolamento", () => {
  it("B não vê os dados de A, e o logout não revela dados antigos", async () => {
    const remoteA = open(userA);
    await remoteA.load();
    const song = await remoteA.songs.create({ ...hosted, title: "Exclusiva de A" });

    await authRequest("sign-out", {}, userA.cookie);
    await remoteA.load();
    expect(remoteA.getSnapshot()).toEqual({ status: "remote-error", reason: "session-expired" });
    remoteA.dispose();

    const remoteB = open(userB);
    await remoteB.load();

    expect(loaded(remoteB).songs).toEqual([]);
    expect(await remoteB.songs.findById(song.id)).toBeNull();
    const backup = await fetchAccountBackup(userB.id, routeFetch(userB.cookie));
    expect(JSON.stringify(backup)).not.toContain("Exclusiva de A");
  });
});

describe("F: compartilhamento", () => {
  it("publica, abre sem sessão, atualiza e revoga", async () => {
    const library = createLibraryService(userA.id);
    const song = await library.songs.create(hosted);
    const repertoire = await library.repertoires.create({ name: "Show", description: "" });
    await latest(library).repertoires.addSong(repertoire.id, song.id);

    const selection: ShareSelection = {
      authorizations: [{ songId: song.id, confirmed: true, declarationVersion: RIGHTS_DECLARATION_VERSION }],
    };
    const preview = await library.shares.preview(repertoire.id, selection);
    const share = await library.shares.create(repertoire.id, { ...selection, expectedHash: preview.contentHash });
    const token = share.path!.replace("/s/", "");

    const openPublic = (): Promise<Response> =>
      publicRoute.GET(new Request(`${ORIGIN}/api/v1/public/shares/${token}`), {
        params: Promise.resolve({ token }),
      });

    expect(((await (await openPublic()).json()) as { share: { name: string } }).share.name).toBe("Show");

    await latest(library).repertoires.update(repertoire.id, { name: "Atualizado", description: "" });
    const updatePreview = await library.shares.previewUpdate(repertoire.id, share.id, selection);
    await library.shares.update(repertoire.id, share.id, {
      ...selection,
      expectedHash: updatePreview.contentHash,
      expectedRevision: share.revision,
    });
    expect(((await (await openPublic()).json()) as { share: { name: string } }).share.name).toBe("Atualizado");

    await library.shares.revoke(repertoire.id, share.id);
    expect((await openPublic()).status).toBe(404);
  });
});

describe("exportação do backup", () => {
  async function fill(user: TestUser) {
    const library = createLibraryService(user.id);
    const first = await library.songs.create({ ...hosted, title: "Primeira", chordPro: "[G]Cifra completa" });
    const second = await library.songs.create({ ...hosted, title: "Segunda" });
    const repertoire = await library.repertoires.create({ name: "Show", description: "Descrição" });
    await latest(library).repertoires.addSong(repertoire.id, first.id);
    const full = await latest(library).repertoires.addSong(repertoire.id, second.id);
    await latest(library).repertoires.updateItem(repertoire.id, full.items[1].id, {
      transposeSemitones: 3,
      notes: "Anotação do item",
    });
    await latest(library).repertoires.moveItem(repertoire.id, full.items[1].id, "up");
    return { library, first, second, repertoire: full };
  }

  it("contém a biblioteca completa, com IDs, datas, ordem, anotações e cifras", async () => {
    const { library, first, repertoire } = await fill(userA);

    const backup = await fetchAccountBackup(userA.id, routeFetch(userA.cookie));

    expect(backup.schemaVersion).toBe(1);
    expect(backup.songs).toHaveLength(2);
    // O backup tem tudo, menos a revisão, que é controle de edição da conta.
    expect(backup.songs.find((song) => song.id === first.id)).toEqual({
      ...(await library.songs.findById(first.id)),
      revision: undefined,
    });
    const exported = backup.repertoires.find((entry) => entry.id === repertoire.id);
    expect(exported).toEqual({ ...(await library.repertoires.findById(repertoire.id)), revision: undefined });
    expect(exported?.items.find((item) => item.position === 1)).toMatchObject({
      transposeSemitones: 3,
      notes: "Anotação do item",
    });
  });

  it("não inclui credenciais, proprietário nem publicações", async () => {
    const { library, repertoire } = await fill(userA);
    const selection = { authorizations: [] };
    const preview = await library.shares.preview(repertoire.id, selection);
    const share = await library.shares.create(repertoire.id, { ...selection, expectedHash: preview.contentHash });

    const response = await exportRoute.GET(
      new Request(`${ORIGIN}/api/v1/library/export`, { headers: { cookie: userA.cookie } }),
      { params: Promise.resolve({}) },
    );
    const text = await response.text();

    expect(response.headers.get("cache-control")).toBe("private, no-store");
    for (const forbidden of ["ownerId", userA.id, userA.email, share.id, share.path!, "tokenVersion", "shareVersion", "referenceVersion", "_id"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("um backup exportado pode ser importado em uma conta vazia", async () => {
    await fill(userA);
    const backup = await fetchAccountBackup(userA.id, routeFetch(userA.cookie));

    const imported = await createLibraryService(userB.id).imports.execute({
      importId: crypto.randomUUID(),
      backup,
    });

    expect(imported.summary).toMatchObject({ songs: 2, repertoires: 1 });
  });

  it("recusa sem sessão", async () => {
    const response = await exportRoute.GET(new Request(`${ORIGIN}/api/v1/library/export`), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(401);
  });

  it("entrega somente os dados de quem pediu", async () => {
    await fill(userA);

    const backup = await fetchAccountBackup(userB.id, routeFetch(userB.cookie));

    expect(backup.songs).toEqual([]);
    expect(backup.repertoires).toEqual([]);
  });
});
