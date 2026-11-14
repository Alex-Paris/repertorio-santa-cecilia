import mongoose from "mongoose";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as importRoute from "@/app/api/v1/library/import/route";
import * as previewRoute from "@/app/api/v1/library/import/preview/route";
import * as statusRoute from "@/app/api/v1/library/imports/[importId]/route";
import * as repertoiresRoute from "@/app/api/v1/library/repertoires/route";
import * as songsRoute from "@/app/api/v1/library/songs/route";
import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import { demoSongs } from "@/features/songs/data/demo-songs";
import { closeMongoose } from "@/server/database/mongoose-connection";
import { LibraryImportModel } from "@/server/database/models/library-import-model";
import { LibraryStateModel } from "@/server/database/models/library-state-model";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { SongModel } from "@/server/database/models/song-model";
import { createLibraryService } from "@/server/library/library-service";

import {
  clearDatabase,
  createTestUser,
  dropTestDatabase,
  hostedSong,
  ORIGIN,
  type TestUser,
} from "./helpers";

const backup = {
  schemaVersion: 1,
  exportedAt: "2026-11-08T12:00:00.000Z",
  songs: demoSongs,
  repertoires: demoRepertoires,
};

const none = { params: Promise.resolve({}) };

let userA: TestUser;
let userB: TestUser;

beforeEach(async () => {
  await clearDatabase();
  userA = await createTestUser("usuaria-a");
  userB = await createTestUser("usuario-b");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(dropTestDatabase);

function post(cookie: string | undefined, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/v1/library/import`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function runImport(user: TestUser, importId: string = crypto.randomUUID(), payload: unknown = backup) {
  return importRoute.POST(post(user.cookie, { importId, backup: payload }), none);
}

function runStatus(user: TestUser | undefined, importId: string) {
  return statusRoute.GET(
    new Request(`${ORIGIN}/api/v1/library/imports/${importId}`, {
      headers: user ? { cookie: user.cookie } : {},
    }),
    { params: Promise.resolve({ importId }) },
  );
}

async function countAll(ownerId: string) {
  const songs = await SongModel.countDocuments({ ownerId });
  const repertoires = await RepertoireModel.countDocuments({ ownerId });
  const imports = await LibraryImportModel.countDocuments({ ownerId });
  return { songs, repertoires, imports };
}

function expectEmpty(counts: Awaited<ReturnType<typeof countAll>>): void {
  expect(counts).toEqual({ songs: 0, repertoires: 0, imports: 0 });
}

describe("A. importação válida", () => {
  it("grava os dados com proprietário, IDs, datas, tons e anotações preservados", async () => {
    const importId = crypto.randomUUID();

    const response = await runImport(userA, importId);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.import).toMatchObject({
      importId,
      status: "completed",
      replayed: false,
      songs: 6,
      repertoires: 2,
      items: 7,
      schemaVersion: 1,
    });

    const songs = await SongModel.find({ ownerId: userA.id }).lean();
    expect(songs).toHaveLength(6);

    for (const original of demoSongs) {
      const stored = songs.find((song) => song.id === original.id);
      expect(stored).toMatchObject({
        ownerId: userA.id,
        title: original.title,
        artist: original.artist,
        originalKey: original.originalKey,
        contentType: original.contentType,
      });
      expect(stored?.createdAt.toISOString()).toBe(original.createdAt);
      expect(stored?.updatedAt.toISOString()).toBe(original.updatedAt);
      expect(stored?.chordPro).toBe(original.chordPro);
      expect(stored?.sourceUrl).toBe(original.sourceUrl);
    }

    const repertoires = await RepertoireModel.find({ ownerId: userA.id }).lean();
    expect(repertoires).toHaveLength(2);

    for (const original of demoRepertoires) {
      const stored = repertoires.find((repertoire) => repertoire.id === original.id);
      expect(stored?.createdAt.toISOString()).toBe(original.createdAt);
      expect(stored?.updatedAt.toISOString()).toBe(original.updatedAt);
      expect(stored?.items).toEqual(original.items);
    }

    const songIds = new Set(songs.map((song) => song.id));
    expect(repertoires.flatMap((r) => r.items).every((item) => songIds.has(item.songId))).toBe(true);
  });

  it("os dados importados ficam disponíveis pela API, no formato de domínio", async () => {
    await runImport(userA);

    const list = await (await songsRoute.GET(new Request(ORIGIN, { headers: { cookie: userA.cookie } }), none)).json();
    const reps = await (await repertoiresRoute.GET(new Request(ORIGIN, { headers: { cookie: userA.cookie } }), none)).json();

    // Além dos dados do backup, cada documento importado começa na revisão 1.
    expect(list.songs.find((song: { id: string }) => song.id === "song-caminhos")).toEqual({ ...demoSongs[0], revision: 1 });
    expect(reps.repertoires.find((r: { id: string }) => r.id === "rep-sarau-de-domingo")).toEqual({
      ...demoRepertoires[0],
      revision: 1,
    });
  });

  it("o registro guarda o hash, e não o conteúdo do backup", async () => {
    const importId = crypto.randomUUID();
    await runImport(userA, importId);

    const record = await LibraryImportModel.findOne({ importId }).lean();

    expect(record?.ownerId).toBe(userA.id);
    expect(record?.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(record)).not.toContain("Hoje vou");
  });

  it("a resposta não traz cifras, hash nem IDs internos", async () => {
    const text = await (await runImport(userA)).text();

    expect(text).not.toContain("Hoje vou");
    expect(text).not.toContain("contentHash");
    expect(text).not.toContain("ownerId");
    expect(text).not.toContain("_id");
  });

  it("o preview não grava nada", async () => {
    const response = await previewRoute.POST(post(userA.cookie, { backup }), none);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.preview).toMatchObject({ canImport: true, remote: { isEmpty: true }, summary: { songs: 6 } });
    expectEmpty(await countAll(userA.id));
    expect(await LibraryStateModel.countDocuments({ ownerId: userA.id })).toBe(0);
  });
});

describe("política de biblioteca vazia", () => {
  it("recusa com 409 e não altera a conta preenchida", async () => {
    const { songs } = createLibraryService(userA.id);
    const existing = await songs.create(hostedSong);

    const response = await runImport(userA);

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("remote_library_not_empty");
    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(1);
    await expect(songs.findById(existing.id)).resolves.toEqual(existing);
    expect(await LibraryImportModel.countDocuments({ ownerId: userA.id })).toBe(0);
  });

  it("recusa quando a conta possui somente repertórios", async () => {
    await createLibraryService(userA.id).repertoires.create({ name: "R", description: "" });

    expect((await runImport(userA)).status).toBe(409);
  });

  it("o preview aponta o conflito", async () => {
    await createLibraryService(userA.id).songs.create(hostedSong);

    const body = await (await previewRoute.POST(post(userA.cookie, { backup }), none)).json();

    expect(body.preview).toMatchObject({ canImport: false, conflicts: ["remote_library_not_empty"] });
  });
});

describe("B. isolamento", () => {
  it("B não vê os dados importados por A e pode importar os mesmos IDs", async () => {
    await runImport(userA);

    const list = await (await songsRoute.GET(new Request(ORIGIN, { headers: { cookie: userB.cookie } }), none)).json();
    expect(list.songs).toEqual([]);

    expect((await runImport(userB)).status).toBe(201);
    expect(await SongModel.countDocuments({ ownerId: userB.id })).toBe(6);
    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(6);
  });

  it("B não acessa o status da importação de A", async () => {
    const importId = crypto.randomUUID();
    await runImport(userA, importId);

    const other = await (await runStatus(userB, importId)).json();

    expect(other.import).toMatchObject({ status: "unknown", importId });
    expect(other.import).not.toHaveProperty("songs");
  });

  it("o mesmo importId de usuários diferentes não se confunde", async () => {
    const importId = crypto.randomUUID();

    expect((await runImport(userA, importId)).status).toBe(201);
    expect((await runImport(userB, importId, { schemaVersion: 1, songs: [demoSongs[0]], repertoires: [] })).status).toBe(201);
  });

  it.each([
    ["no corpo", (id: string) => ({ importId: crypto.randomUUID(), backup, ownerId: id })],
    ["na música", (id: string) => ({ importId: crypto.randomUUID(), backup: { ...backup, songs: [{ ...demoSongs[0], ownerId: id }], repertoires: [] } })],
    ["no repertório", (id: string) => ({ importId: crypto.randomUUID(), backup: { ...backup, repertoires: [{ ...demoRepertoires[0], ownerId: id }] } })],
  ])("rejeita ownerId arbitrário %s", async (_name, build) => {
    const response = await importRoute.POST(post(userA.cookie, build(userB.id)), none);

    expect(response.status).toBe(400);
    expectEmpty(await countAll(userA.id));
    expectEmpty(await countAll(userB.id));
  });
});

describe("autenticação e proteções da API", () => {
  it.each([
    ["import", () => importRoute.POST(post(undefined, { importId: crypto.randomUUID(), backup }), none)],
    ["preview", () => previewRoute.POST(post(undefined, { backup }), none)],
    ["status", () => runStatus(undefined, crypto.randomUUID())],
  ])("%s exige sessão", async (_name, call) => {
    expect((await call()).status).toBe(401);
  });

  it("recusa outra origem e outro tipo de conteúdo", async () => {
    const body = { importId: crypto.randomUUID(), backup };

    expect((await importRoute.POST(post(userA.cookie, body, { origin: "https://site-malicioso.example" }), none)).status).toBe(403);
    expect((await importRoute.POST(post(userA.cookie, body, { "content-type": "text/plain" }), none)).status).toBe(415);
    expectEmpty(await countAll(userA.id));
  });

  it("recusa payload acima do limite com 413", async () => {
    const huge = "x".repeat(6 * 1024 * 1024);

    const response = await importRoute.POST(post(userA.cookie, { importId: crypto.randomUUID(), backup: huge }), none);

    expect(response.status).toBe(413);
  });

  it("recusa JSON e backup inválidos com 400, sem detalhes internos", async () => {
    expect((await importRoute.POST(post(userA.cookie, "{ quebrado"), none)).status).toBe(400);

    const response = await runImport(userA, crypto.randomUUID(), { schemaVersion: 1, songs: [demoSongs[0], demoSongs[0]], repertoires: [] });
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("mesmo ID");
    expect(text).not.toMatch(/stack|mongoose|mongodb/i);
    expectEmpty(await countAll(userA.id));
  });
});

describe("C. atomicidade", () => {
  it("desfaz as músicas quando a inserção dos repertórios falha", async () => {
    const original = RepertoireModel.insertMany.bind(RepertoireModel);
    let songsSeenInTransaction = -1;

    vi.spyOn(RepertoireModel, "insertMany").mockImplementationOnce((async (_docs: unknown, options: { session: mongoose.ClientSession }) => {
      songsSeenInTransaction = await SongModel.countDocuments({ ownerId: userA.id }).session(options.session);
      throw new Error("falha simulada na inserção");
    }) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const importId = crypto.randomUUID();
    const response = await runImport(userA, importId);

    expect(original).toBeDefined();
    expect(songsSeenInTransaction).toBe(6);
    expect(response.status).toBe(503);
    expectEmpty(await countAll(userA.id));
    expect((await (await runStatus(userA, importId)).json()).import.status).toBe("unknown");
  });

  it("desfaz tudo quando o registro da importação falha", async () => {
    vi.spyOn(LibraryImportModel, "create").mockImplementationOnce((async () => {
      throw new Error("falha simulada no registro");
    }) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await runImport(userA);

    expect(response.status).toBe(503);
    expectEmpty(await countAll(userA.id));
    expect(await RepertoireModel.countDocuments({ "items.songId": "song-caminhos" })).toBe(0);
  });

  it("desfaz tudo em uma violação real do índice único", async () => {
    // Um documento fora do alcance da verificação inicial força o erro na segunda inserção.
    vi.spyOn(SongModel, "exists").mockImplementation((() => ({ session: async () => null })) as never);
    vi.spyOn(RepertoireModel, "exists").mockImplementation((() => ({ session: async () => null })) as never);
    await SongModel.create({
      id: demoSongs[5].id,
      ownerId: userA.id,
      title: "Já existe",
      artist: "A",
      originalKey: "C",
      contentType: "original",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await runImport(userA);

    expect(response.status).toBe(409);
    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(1);
    expect(await RepertoireModel.countDocuments({ ownerId: userA.id })).toBe(0);
    expect(await LibraryImportModel.countDocuments({ ownerId: userA.id })).toBe(0);
  });
});

describe("D. idempotência", () => {
  it("repetir a mesma requisição devolve o resultado anterior, sem duplicar", async () => {
    const importId = crypto.randomUUID();

    const first = await (await runImport(userA, importId)).json();
    const repeated = await runImport(userA, importId);
    const body = await repeated.json();

    expect(repeated.status).toBe(200);
    expect(body.import).toEqual({ ...first.import, replayed: true });
    expect(await countAll(userA.id)).toEqual({ songs: 6, repertoires: 2, imports: 1 });
  });

  it("outro exportedAt com o mesmo conteúdo continua sendo a mesma importação", async () => {
    const importId = crypto.randomUUID();
    await runImport(userA, importId);

    const repeated = await runImport(userA, importId, { ...backup, exportedAt: "2030-01-01T00:00:00.000Z" });

    expect(repeated.status).toBe(200);
  });

  it("o mesmo importId com outro conteúdo é conflito", async () => {
    const importId = crypto.randomUUID();
    await runImport(userA, importId);

    const response = await runImport(userA, importId, { schemaVersion: 1, songs: [demoSongs[0]], repertoires: [] });

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("import_id_conflict");
    expect(await countAll(userA.id)).toEqual({ songs: 6, repertoires: 2, imports: 1 });
  });

  it("outro importId para a conta já importada é conflito", async () => {
    await runImport(userA);

    const response = await runImport(userA);

    expect((await response.json()).error.code).toBe("remote_library_not_empty");
    expect(await LibraryImportModel.countDocuments({ ownerId: userA.id })).toBe(1);
  });

  it("o índice único impede dois registros para o mesmo importId", async () => {
    const importId = crypto.randomUUID();
    const record = {
      ownerId: userA.id,
      importId,
      contentHash: "a".repeat(64),
      schemaVersion: 1,
      songs: 0,
      repertoires: 0,
      items: 0,
      completedAt: new Date(),
    };
    await LibraryImportModel.create(record);

    await expect(LibraryImportModel.create(record)).rejects.toMatchObject({ code: 11000 });
  });

  it("os índices documentados existem", async () => {
    const keys = async (collection: typeof LibraryImportModel.collection | typeof LibraryStateModel.collection) =>
      (await collection.indexes()).map((index) => JSON.stringify({ key: index.key, unique: index.unique ?? false }));

    expect(await keys(LibraryImportModel.collection)).toContain('{"key":{"ownerId":1,"importId":1},"unique":true}');
    expect(await keys(LibraryStateModel.collection)).toContain('{"key":{"ownerId":1},"unique":true}');
  });
});

describe("resultado incerto", () => {
  it("após um commit sem resposta, o status confirma e a repetição não duplica", async () => {
    const original = mongoose.connection.transaction.bind(mongoose.connection);
    vi.spyOn(mongoose.connection, "transaction").mockImplementationOnce((async (fn: never, options: never) => {
      await original(fn, options);
      throw new Error("conexão perdida após o commit");
    }) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const importId = crypto.randomUUID();

    const lost = await runImport(userA, importId);

    expect(lost.status).toBe(503);
    expect(await countAll(userA.id)).toEqual({ songs: 6, repertoires: 2, imports: 1 });

    const status = await (await runStatus(userA, importId)).json();
    expect(status.import).toMatchObject({ status: "completed", importId, songs: 6, repertoires: 2 });

    const retried = await runImport(userA, importId);
    expect(retried.status).toBe(200);
    expect((await retried.json()).import.replayed).toBe(true);
    expect(await countAll(userA.id)).toEqual({ songs: 6, repertoires: 2, imports: 1 });
  });

  it("sem registro, o status não afirma sucesso nem falha", async () => {
    const body = await (await runStatus(userA, crypto.randomUUID())).json();

    expect(body.import.status).toBe("unknown");
    expect(body.import.message).toContain("não indica sucesso nem falha");
  });

  it("identificador malformado responde 400", async () => {
    expect((await runStatus(userA, "nao-e-uuid")).status).toBe(400);
  });
});

describe("E. concorrência", () => {
  it("duas importações simultâneas diferentes: exatamente uma conclui", async () => {
    for (let round = 0; round < 8; round++) {
      await clearDatabase();

      const responses = await Promise.all([runImport(userA), runImport(userA)]);
      const statuses = responses.map((response) => response.status).sort();

      expect(statuses).toEqual([201, 409]);
      expect(await countAll(userA.id)).toEqual({ songs: 6, repertoires: 2, imports: 1 });
    }
  });

  it("a mesma importação enviada em paralelo não duplica", async () => {
    const importId = crypto.randomUUID();

    const responses = await Promise.all([
      runImport(userA, importId),
      runImport(userA, importId),
      runImport(userA, importId),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 201]);
    expect(await countAll(userA.id)).toEqual({ songs: 6, repertoires: 2, imports: 1 });
  });

  it("criação concorrente nunca produz importação parcial nem conta inconsistente", async () => {
    const { songs } = createLibraryService(userA.id);
    const outcomes = new Set<string>();

    for (let round = 0; round < 15; round++) {
      await clearDatabase();

      const [imported, created] = await Promise.all([
        runImport(userA),
        songs.create({ ...hostedSong, title: `Criada ${round}` }),
      ]);
      const counts = await countAll(userA.id);

      outcomes.add(String(imported.status));

      if (imported.status === 201) {
        // A importação viu a conta vazia: a criação só pode ter sido confirmada depois.
        expect(counts).toEqual({ songs: 7, repertoires: 2, imports: 1 });
      } else {
        expect(imported.status).toBe(409);
        expect(counts).toEqual({ songs: 1, repertoires: 0, imports: 0 });
      }
      await expect(songs.findById(created.id)).resolves.toMatchObject({ title: `Criada ${round}` });
    }

    expect([...outcomes].every((status) => ["201", "409"].includes(status))).toBe(true);
  });

  it("criação de repertório concorrente respeita a mesma política", async () => {
    const { repertoires } = createLibraryService(userA.id);

    for (let round = 0; round < 10; round++) {
      await clearDatabase();

      const [imported] = await Promise.all([
        runImport(userA),
        repertoires.create({ name: `R${round}`, description: "" }),
      ]);
      const counts = await countAll(userA.id);

      expect(counts).toEqual(
        imported.status === 201
          ? { songs: 6, repertoires: 3, imports: 1 }
          : { songs: 0, repertoires: 1, imports: 0 },
      );
    }
  });

  it("criações paralelas continuam funcionando", async () => {
    const { songs } = createLibraryService(userA.id);

    await Promise.all(Array.from({ length: 8 }, (_, index) => songs.create({ ...hostedSong, title: `M${index}` })));

    expect(await SongModel.countDocuments({ ownerId: userA.id })).toBe(8);
  });

  it("usuários diferentes não bloqueiam um ao outro", async () => {
    const responses = await Promise.all([runImport(userA), runImport(userB)]);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
  });
});

describe("F. banco indisponível", () => {
  it("responde 503, não indica conclusão e recupera após reconectar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const importId = crypto.randomUUID();
    const realUri = process.env.MONGODB_URI as string;

    await closeMongoose();
    vi.stubEnv("MONGODB_URI", "mongodb://127.0.0.1:1/?directConnection=true");

    const failed = await runImport(userA, importId);
    const text = await failed.text();

    expect(failed.status).toBe(503);
    expect(text).not.toMatch(/completed|127\.0\.0\.1|stack/);
    expect((await runStatus(userA, importId)).status).toBe(503);

    vi.stubEnv("MONGODB_URI", realUri);

    expect((await (await runStatus(userA, importId)).json()).import.status).toBe("unknown");
    expectEmpty(await countAll(userA.id));

    const recovered = await runImport(userA, importId);
    expect(recovered.status).toBe(201);
    expect(await countAll(userA.id)).toEqual({ songs: 6, repertoires: 2, imports: 1 });
  });
});
