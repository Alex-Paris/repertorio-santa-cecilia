import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as importRoute from "@/app/api/v1/library/import/route";
import * as publicRoute from "@/app/api/v1/public/shares/[token]/route";
import * as itemRoute from "@/app/api/v1/library/repertoires/[id]/items/[itemId]/route";
import * as songRoute from "@/app/api/v1/library/songs/[id]/route";
import * as songsRoute from "@/app/api/v1/library/songs/route";
import { createHttpRepertoireRepository, createHttpSongRepository } from "@/features/library/data/remote/http-repositories";
import { createLibraryApi } from "@/features/library/data/remote/library-api";
import { RIGHTS_DECLARATION_VERSION, type ShareSelection } from "@/features/sharing/domain/public-share";
import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import { demoSongs } from "@/features/songs/data/demo-songs";
import type { SongInput } from "@/features/songs/domain/song";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { SongModel } from "@/server/database/models/song-model";
import { createLibraryService } from "@/server/library/library-service";

import { clearDatabase, createTestUser, dropTestDatabase, hostedSong, ORIGIN, type TestUser } from "./helpers";
import { routeFetch } from "./route-fetch";

const hosted: SongInput = {
  title: hostedSong.title,
  artist: hostedSong.artist,
  originalKey: hostedSong.originalKey,
  contentType: "original",
  chordPro: "[G]Primeira versão",
};

let userA: TestUser;
let userB: TestUser;

beforeEach(async () => {
  vi.stubEnv("PUBLIC_SHARING_ENABLED", "true");
  vi.stubEnv("SHARE_LINK_SECRET", "chave-de-integracao-com-mais-de-32-caracteres");
  await clearDatabase();
  userA = await createTestUser("usuaria-a");
  userB = await createTestUser("usuario-b");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(dropTestDatabase);

/** Um "dispositivo": cliente HTTP real sobre as rotas, com o cookie da conta. */
function device(user: TestUser) {
  const api = createLibraryApi({ userId: user.id, fetchImpl: routeFetch(user.cookie) });
  return { songs: createHttpSongRepository(api), repertoires: createHttpRepertoireRepository(api) };
}

function request(user: TestUser | null, method: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/v1/library/x`, {
    method,
    headers: {
      origin: ORIGIN,
      ...(user ? { cookie: user.cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("A: dois dispositivos", () => {
  it("a segunda gravação com a revisão antiga é recusada e a primeira permanece", async () => {
    const created = await device(userA).songs.create(hosted);
    const first = device(userA);
    const second = device(userA);

    expect((await first.songs.findById(created.id))?.revision).toBe(1);
    expect((await second.songs.findById(created.id))?.revision).toBe(1);

    const saved = await first.songs.update(created.id, { ...hosted, title: "Do primeiro" }, 1);
    expect(saved.revision).toBe(2);

    await expect(second.songs.update(created.id, { ...hosted, title: "Do segundo" }, 1)).rejects.toMatchObject({
      code: "revision-conflict",
    });

    const stored = await SongModel.findOne({ ownerId: userA.id, id: created.id }).lean();
    expect(stored).toMatchObject({ title: "Do primeiro", revision: 2 });
  });

  it("gravações simultâneas da mesma revisão: exatamente uma vence", async () => {
    const created = await device(userA).songs.create(hosted);

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        device(userA).songs.update(created.id, { ...hosted, title: `Versão ${index}` }, 1),
      ),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await SongModel.findOne({ id: created.id }).lean())?.revision).toBe(2);
  });
});

describe("B: repertório em dois clientes", () => {
  it("detecta a revisão antiga e preserva as duas alterações depois de refazer", async () => {
    const owner = device(userA);
    const a = await owner.songs.create(hosted);
    const b = await owner.songs.create({ ...hosted, title: "Segunda" });
    const created = await owner.repertoires.create({ name: "Show", description: "" });
    await owner.repertoires.addSong(created.id, a.id, 1);
    const repertoire = await owner.repertoires.addSong(created.id, b.id, 2);
    const [first, second] = repertoire.items;

    const client1 = device(userA);
    const client2 = device(userA);
    const seenBy2 = await client2.repertoires.findById(repertoire.id);

    await client1.repertoires.updateItem(repertoire.id, first.id, { transposeSemitones: 3 }, repertoire.revision);

    await expect(
      client2.repertoires.updateItem(repertoire.id, second.id, { notes: "Do cliente 2" }, seenBy2!.revision),
    ).rejects.toMatchObject({ code: "revision-conflict" });

    const latest = await client2.repertoires.findById(repertoire.id);
    await client2.repertoires.updateItem(repertoire.id, second.id, { notes: "Do cliente 2" }, latest!.revision);

    const stored = await RepertoireModel.findOne({ ownerId: userA.id, id: repertoire.id }).lean();
    expect(stored?.items.find((item) => item.id === first.id)?.transposeSemitones).toBe(3);
    expect(stored?.items.find((item) => item.id === second.id)?.notes).toBe("Do cliente 2");
    expect(stored?.revision).toBe(repertoire.revision + 2);
  });
});

describe("C: exclusão", () => {
  it("excluir com revisão antiga é recusado e o documento é preservado", async () => {
    const created = await device(userA).songs.create(hosted);
    const client1 = device(userA);
    const seen = await client1.songs.findById(created.id);

    await device(userA).songs.update(created.id, { ...hosted, title: "Atualizada" }, 1);

    await expect(client1.songs.delete(created.id, seen!.revision)).rejects.toMatchObject({
      code: "revision-conflict",
    });
    expect(await SongModel.findOne({ id: created.id }).lean()).toMatchObject({ title: "Atualizada" });
  });

  it("a exclusão de repertório com links continua revogando na mesma transação", async () => {
    const library = createLibraryService(userA.id);
    const song = await library.songs.create(hosted);
    const created = await library.repertoires.create({ name: "Show", description: "" });
    const repertoire = await library.repertoires.addSong(created.id, song.id, 1);
    const selection: ShareSelection = { authorizations: [] };
    const preview = await library.shares.preview(repertoire.id, selection);
    const share = await library.shares.create(repertoire.id, { ...selection, expectedHash: preview.contentHash });

    await expect(library.repertoires.delete(repertoire.id, 1)).rejects.toMatchObject({ code: "revision-conflict" });
    expect((await library.shares.listAll()).map((entry) => entry.id)).toEqual([share.id]);

    await library.repertoires.delete(repertoire.id, repertoire.revision);
    expect(await library.shares.listAll()).toEqual([]);
  });
});

describe("D: autorização", () => {
  it("B não altera nem descobre documentos de A, mesmo com ID e revisão", async () => {
    const song = await device(userA).songs.create(hosted);

    const update = await songRoute.PUT(request(userB, "PUT", hosted, { "If-Match": '"1"' }), {
      params: Promise.resolve({ id: song.id }),
    });
    const remove = await songRoute.DELETE(request(userB, "DELETE", undefined, { "If-Match": '"1"' }), {
      params: Promise.resolve({ id: song.id }),
    });
    const missing = await songRoute.PUT(request(userA, "PUT", hosted, { "If-Match": '"1"' }), {
      params: Promise.resolve({ id: "nao-existe" }),
    });

    expect([update.status, remove.status]).toEqual([404, 404]);
    expect(await update.text()).not.toContain(hosted.title);
    expect(missing.status).toBe(404);
    expect(await SongModel.findOne({ id: song.id }).lean()).toMatchObject({ title: hosted.title, revision: 1 });
  });
});

describe("contrato HTTP", () => {
  it("If-Match obrigatório: 428 sem ele, 412 com revisão antiga, ETag com a atual", async () => {
    const song = await device(userA).songs.create(hosted);
    const params = { params: Promise.resolve({ id: song.id }) };

    const missing = await songRoute.PUT(request(userA, "PUT", hosted), params);
    const wildcard = await songRoute.PUT(request(userA, "PUT", hosted, { "If-Match": "*" }), params);
    const ok = await songRoute.PUT(request(userA, "PUT", { ...hosted, title: "Nova" }, { "If-Match": '"1"' }), params);
    const stale = await songRoute.PUT(request(userA, "PUT", hosted, { "If-Match": '"1"' }), params);
    const deleteStale = await songRoute.DELETE(request(userA, "DELETE", undefined, { "If-Match": '"1"' }), params);

    expect([missing.status, wildcard.status, ok.status, stale.status, deleteStale.status]).toEqual([428, 428, 200, 412, 412]);
    expect(ok.headers.get("etag")).toBe('"2"');
    expect(ok.headers.get("cache-control")).toBe("private, no-store");
    expect(((await stale.json()) as { error: { code: string } }).error.code).toBe("precondition_failed");
    expect(((await ok.json()) as { song: { revision: number } }).song.revision).toBe(2);
    expect(await SongModel.findOne({ id: song.id }).lean()).toMatchObject({ title: "Nova", revision: 2 });
  });

  it("operações de item também exigem If-Match", async () => {
    const owner = device(userA);
    const song = await owner.songs.create(hosted);
    const created = await owner.repertoires.create({ name: "R", description: "" });
    const repertoire = await owner.repertoires.addSong(created.id, song.id, 1);

    const response = await itemRoute.PATCH(request(userA, "PATCH", { notes: "x" }), {
      params: Promise.resolve({ id: repertoire.id, itemId: repertoire.items[0].id }),
    });

    expect(response.status).toBe(428);
    expect((await RepertoireModel.findOne({ id: repertoire.id }).lean())?.items[0].notes).toBeUndefined();
  });

  it("sem sessão continua 401", async () => {
    const song = await device(userA).songs.create(hosted);

    const response = await songRoute.PUT(request(null, "PUT", hosted, { "If-Match": '"1"' }), {
      params: Promise.resolve({ id: song.id }),
    });

    expect(response.status).toBe(401);
  });

  it("criação e leitura informam a revisão", async () => {
    const created = await songsRoute.POST(request(userA, "POST", hosted), { params: Promise.resolve({}) });
    const body = (await created.json()) as { song: { id: string; revision: number } };

    expect(body.song.revision).toBe(1);
    expect(created.headers.get("etag")).toBe('"1"');

    const read = await songRoute.GET(request(userA, "GET"), { params: Promise.resolve({ id: body.song.id }) });
    expect(read.headers.get("etag")).toBe('"1"');
  });

  it("documentos anteriores ao controle de versão valem como revisão 1", async () => {
    await SongModel.collection.insertOne({
      id: "anterior",
      ownerId: userA.id,
      title: "Sem revisão",
      artist: "A",
      originalKey: "G",
      contentType: "original",
      referenceVersion: 0,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    const client = device(userA);

    expect((await client.songs.findById("anterior"))?.revision).toBe(1);
    const updated = await client.songs.update("anterior", hosted, 1);

    expect(updated.revision).toBe(2);
    await expect(client.songs.update("anterior", hosted, 1)).rejects.toMatchObject({ code: "revision-conflict" });
  });
});

describe("E: importação", () => {
  it("backup antigo sem revisão: documentos começam na revisão 1 e a concorrência funciona", async () => {
    const response = await importRoute.POST(
      request(userA, "POST", {
        importId: crypto.randomUUID(),
        backup: { schemaVersion: 1, exportedAt: "2025-01-01T00:00:00.000Z", songs: demoSongs, repertoires: demoRepertoires },
      }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(201);

    const songs = await SongModel.find({ ownerId: userA.id }).lean();
    const repertoires = await RepertoireModel.find({ ownerId: userA.id }).lean();
    expect(songs.every((song) => song.revision === 1)).toBe(true);
    expect(repertoires.every((repertoire) => repertoire.revision === 1)).toBe(true);

    const client = device(userA);
    const [repertoire] = demoRepertoires;
    await client.repertoires.update(repertoire.id, { name: "Editado", description: "" }, 1);
    await expect(
      client.repertoires.update(repertoire.id, { name: "Antigo", description: "" }, 1),
    ).rejects.toMatchObject({ code: "revision-conflict" });
  });

  it("a exportação continua sem revisão", async () => {
    const library = createLibraryService(userA.id);
    await library.songs.create(hosted);

    const backup = await library.exportBackup();

    expect(backup.schemaVersion).toBe(1);
    expect(JSON.stringify(backup)).not.toContain("revision");
  });
});

describe("F: publicações", () => {
  it("revisões privadas não mexem no snapshot; atualizar e revogar seguem funcionando", async () => {
    const library = createLibraryService(userA.id);
    const song = await library.songs.create(hosted);
    const created = await library.repertoires.create({ name: "Show", description: "" });
    const repertoire = await library.repertoires.addSong(created.id, song.id, 1);
    const selection: ShareSelection = {
      authorizations: [{ songId: song.id, confirmed: true, declarationVersion: RIGHTS_DECLARATION_VERSION }],
    };
    const preview = await library.shares.preview(repertoire.id, selection);
    const share = await library.shares.create(repertoire.id, { ...selection, expectedHash: preview.contentHash });
    const token = share.path!.replace("/s/", "");
    const open = async () =>
      (await (
        await publicRoute.GET(new Request(`${ORIGIN}/api/v1/public/shares/${token}`), {
          params: Promise.resolve({ token }),
        })
      ).json()) as { share?: { items: { content: { chordPro?: string } }[] } };

    await library.songs.update(song.id, { ...hosted, chordPro: "[A]Segunda versão" }, 1);

    const before = await open();
    expect(before.share?.items[0].content.chordPro).toBe("[G]Primeira versão");
    expect(JSON.stringify(before)).not.toContain("revision");

    const updatePreview = await library.shares.previewUpdate(repertoire.id, share.id, selection);
    await library.shares.update(repertoire.id, share.id, {
      ...selection,
      expectedHash: updatePreview.contentHash,
      expectedRevision: share.revision,
    });
    expect((await open()).share?.items[0].content.chordPro).toBe("[A]Segunda versão");
    expect((await library.repertoires.findById(repertoire.id))?.revision).toBe(repertoire.revision);

    await library.shares.revoke(repertoire.id, share.id);
    expect((await open()).share).toBeUndefined();
  });
});
