import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as adminApproveRoute from "@/app/api/v1/admin/catalog/submissions/[id]/approve/route";
import * as adminRejectRoute from "@/app/api/v1/admin/catalog/submissions/[id]/reject/route";
import * as adminChangesRoute from "@/app/api/v1/admin/catalog/submissions/[id]/request-changes/route";
import * as adminSubmissionRoute from "@/app/api/v1/admin/catalog/submissions/[id]/route";
import * as adminQueueRoute from "@/app/api/v1/admin/catalog/submissions/route";
import * as removalRoute from "@/app/api/v1/admin/catalog/songs/[id]/contribution-removal/route";
import * as adminSongsRoute from "@/app/api/v1/admin/catalog/songs/route";
import * as resubmitRoute from "@/app/api/v1/catalog/submissions/[id]/resubmit/route";
import * as mySubmissionRoute from "@/app/api/v1/catalog/submissions/[id]/route";
import * as withdrawRoute from "@/app/api/v1/catalog/submissions/[id]/withdraw/route";
import * as mineRoute from "@/app/api/v1/catalog/submissions/mine/route";
import * as previewRoute from "@/app/api/v1/catalog/submissions/preview/route";
import * as submissionsRoute from "@/app/api/v1/catalog/submissions/route";
import * as publicSongRoute from "@/app/api/v1/catalog/songs/[id]/route";
import * as publicSongsRoute from "@/app/api/v1/catalog/songs/route";
import * as publicShareRoute from "@/app/api/v1/public/shares/[token]/route";
import type { CatalogSong } from "@/features/catalog/domain/catalog-song";
import type { AdminSubmission, MySubmission, SubmissionRequest } from "@/features/contributions/domain/submission";
import { RIGHTS_DECLARATION_VERSION as SHARE_DECLARATION, type ShareSelection } from "@/features/sharing/domain/public-share";
import type { Song } from "@/features/songs/domain/song";
import { CatalogSongModel } from "@/server/database/models/catalog-song-model";
import { CatalogSubmissionModel } from "@/server/database/models/catalog-submission-model";
import { SongModel } from "@/server/database/models/song-model";
import { resetRateLimitsForTests } from "@/server/http/rate-limit";
import { createLibraryService } from "@/server/library/library-service";
import { latest } from "@/test/latest-revision";

import { clearDatabase, createTestUser, dropTestDatabase, ORIGIN, type TestUser } from "./helpers";

const run = promisify(execFile);
const SECRET = "chave-de-integracao-com-mais-de-32-caracteres";

let admin: TestUser;
let admin2: TestUser;
let userA: TestUser;
let userB: TestUser;

function request(user: TestUser | null, method: string, body?: unknown, revision?: number, url = `${ORIGIN}/api/v1/x`): Request {
  return new Request(url, {
    method,
    headers: {
      origin: ORIGIN,
      ...(user ? { cookie: user.cookie, "x-repertorio-expected-user": user.id } : {}),
      ...(revision === undefined ? {} : { "if-match": `"${revision}"` }),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const params = <T extends object>(value: T) => ({ params: Promise.resolve(value) });

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function personalSong(user: TestUser, fields: Partial<Song> = {}): Promise<Song> {
  return createLibraryService(user.id).songs.create({
    title: "[TESTE] Canto da Contribuição",
    artist: "Compositora Fictícia",
    originalKey: "D",
    contentType: "original",
    chordPro: "{title: Canto}\n[D]Vinde [G]todos",
    ...fields,
  } as Parameters<ReturnType<typeof createLibraryService>["songs"]["create"]>[0]);
}

function body(songId: string, overrides: Partial<SubmissionRequest> = {}): SubmissionRequest {
  return {
    songId,
    requestId: crypto.randomUUID(),
    rights: { status: "own-composition", accepted: true, license: { display: true, reproduce: true, redistribute: true } },
    credit: { show: true, name: "Grupo Fictício de Canto" },
    suggestedClassification: { moments: ["entrada"], seasons: [], celebrations: [], themes: [] },
    video: { url: "https://youtu.be/abcdefghijk", ownPerformance: true },
    ...overrides,
  };
}

async function submit(user: TestUser, payload: SubmissionRequest): Promise<Response> {
  return submissionsRoute.POST(request(user, "POST", payload), params({}));
}

async function submitted(user: TestUser, payload: SubmissionRequest): Promise<MySubmission> {
  const response = await submit(user, payload);
  expect(response.status).toBe(201);
  return (await json<{ submission: MySubmission }>(response)).submission;
}

function approveNew(overrides: Record<string, unknown> = {}) {
  return {
    mode: "new",
    requestId: crypto.randomUUID(),
    editorial: { title: "[TESTE] Canto da Contribuição", artist: "Compositora Fictícia" },
    publishContent: true,
    shareContent: false,
    publish: true,
    includeClassification: true,
    includeVideo: true,
    videoVerified: true,
    creditName: "Grupo Fictício de Canto",
    knownDuplicateIds: [],
    duplicatesChecked: true,
    rightsChecked: true,
    ...overrides,
  };
}

function approve(user: TestUser, id: string, revision: number, payload: unknown): Promise<Response> {
  return adminApproveRoute.POST(request(user, "POST", payload, revision), params({ id }));
}

async function approved(id: string, revision: number, payload: unknown = approveNew()) {
  const response = await approve(admin, id, revision, payload);
  expect(response.status).toBe(200);
  return json<{ submission: AdminSubmission; catalogSong: CatalogSong }>(response);
}

async function publicView(id: string): Promise<{ status: number; song?: Record<string, unknown> }> {
  const response = await publicSongRoute.GET(new Request(`${ORIGIN}/api/v1/catalog/songs/${id}`), params({ id }));
  return response.status === 200 ? { status: 200, song: (await json<{ song: Record<string, unknown> }>(response)).song } : { status: response.status };
}

async function search(q: string) {
  const response = await publicSongsRoute.GET(new Request(`${ORIGIN}/api/v1/catalog/songs?q=${encodeURIComponent(q)}`), params({}));
  return json<{ songs: Record<string, unknown>[]; total: number }>(response);
}

beforeEach(async () => {
  resetRateLimitsForTests();
  vi.stubEnv("PUBLIC_SHARING_ENABLED", "true");
  vi.stubEnv("SHARE_LINK_SECRET", SECRET);
  await clearDatabase();
  admin = await createTestUser("admin");
  admin2 = await createTestUser("admin-dois");
  userA = await createTestUser("colaboradora-a");
  userB = await createTestUser("colaborador-b");
  for (const user of [admin, admin2]) {
    await run(process.execPath, ["scripts/catalog-admin.mjs", "grant", "--email", user.email], { env: process.env });
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(dropTestDatabase);

describe("cenário A: envio fica em análise e nada é publicado", () => {
  it("cria a proposta com cópia independente; a música particular e o catálogo não mudam", async () => {
    const song = await personalSong(userA);
    const payload = body(song.id);
    const response = await submit(userA, payload);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const { submission } = await json<{ submission: MySubmission }>(response);

    expect(submission).toMatchObject({ status: "pending", version: 1, personalSongId: song.id, sourceSongRevision: song.revision });
    expect(submission.snapshot).toEqual({
      title: song.title,
      artist: song.artist,
      originalKey: "D",
      contentType: "original",
      chordPro: song.chordPro,
    });
    expect(await CatalogSongModel.countDocuments({})).toBe(0);
    expect((await search("Contribuição")).total).toBe(0);

    // A música particular continua privada e igual; editá-la depois não muda a proposta.
    const stored = await SongModel.findOne({ id: song.id }).lean();
    expect(stored).toMatchObject({ ownerId: userA.id, revision: song.revision, title: song.title });
    await latest(createLibraryService(userA.id)).songs.update(song.id, {
      title: "[TESTE] Título editado depois",
      artist: song.artist,
      originalKey: "E",
      contentType: "original",
      chordPro: "[E]Outra letra",
    });
    const reread = await mySubmissionRoute.GET(request(userA, "GET"), params({ id: submission.id }));
    expect((await json<{ submission: MySubmission }>(reread)).submission.snapshot.title).toBe(song.title);

    // Repetir o mesmo pedido devolve a mesma proposta.
    const repeated = await submit(userA, payload);
    expect(repeated.status).toBe(200);
    expect((await json<{ submission: MySubmission }>(repeated)).submission.id).toBe(submission.id);
    expect(await CatalogSubmissionModel.countDocuments({})).toBe(1);

    // Uma segunda proposta para a mesma música, com outro pedido, é recusada.
    const again = await submit(userA, body(song.id));
    expect(again.status).toBe(409);
    expect((await json<{ error: { reason: string } }>(again)).error.reason).toBe("submission-active");

    const mine = await json<{ submissions: { id: string; status: string }[] }>(await mineRoute.GET(request(userA, "GET"), params({})));
    expect(mine.submissions).toEqual([expect.objectContaining({ id: submission.id, status: "pending" })]);
  });

  it("o documento guarda só o identificador da conta e o vídeo estruturado", async () => {
    const song = await personalSong(userA);
    const submission = await submitted(userA, body(song.id));
    const document = await CatalogSubmissionModel.findOne({ id: submission.id }).lean();
    const text = JSON.stringify(document);
    expect(document?.submittedBy).toBe(userA.id);
    expect(text).not.toContain(userA.email);
    expect(text).not.toContain("youtu.be");
    expect(document?.videoReference).toEqual({ provider: "youtube", videoId: "abcdefghijk", kind: "performance", ownPerformance: true });
    expect(document?.rightsDeclaration).toMatchObject({ status: "own-composition", declarationVersion: "2026-11-contribuicao-v1" });
  });
});

describe("cenário B: aprovação cria a música oficial", () => {
  it("publica com crédito, vídeo e classificação não conferida; a música particular continua intacta", async () => {
    const song = await personalSong(userA);
    const submission = await submitted(userA, body(song.id));

    const { submission: decided, catalogSong } = await approved(submission.id, submission.revision);
    expect(decided).toMatchObject({ status: "approved", resultingCatalogSongId: catalogSong.id, review: { decision: "approve", mode: "new" } });
    expect(catalogSong).toMatchObject({
      status: "published",
      contentType: "original",
      chordPro: song.chordPro,
      rights: { basis: "author-permission", displayChordPro: true, shareChordPro: false, linkExternalSource: false, approvedBy: admin.id },
      liturgy: { moments: ["entrada"], reviewStatus: "pending_review", review: null },
      video: { provider: "youtube", videoId: "abcdefghijk", kind: "performance", submissionId: submission.id },
    });
    expect(catalogSong.rights.evidence).toContain(submission.id);
    expect(catalogSong.contributions?.[0]).toMatchObject({
      submissionId: submission.id,
      mode: "new",
      publicCredit: "Grupo Fictício de Canto",
      license: { display: true, reproduce: true, redistribute: true },
    });

    const view = await publicView(catalogSong.id);
    expect(view.song).toMatchObject({ contributorCredit: "Grupo Fictício de Canto", video: { provider: "youtube", videoId: "abcdefghijk" } });
    const text = JSON.stringify(view.song);
    for (const hidden of [userA.email, userA.id, admin.id, submission.id, "Fictícia de Canto@"]) {
      expect(text).not.toContain(hidden);
    }
    expect((await search("Contribuição")).total).toBe(1);

    // Biblioteca da colaboradora: mesma música, mesmo dono, mesma revisão.
    const stored = await SongModel.findOne({ id: song.id }).lean();
    expect(stored).toMatchObject({ ownerId: userA.id, revision: song.revision });

    const mine = await json<{ submission: MySubmission }>(await mySubmissionRoute.GET(request(userA, "GET"), params({ id: submission.id })));
    expect(mine.submission.resultingCatalogSong).toEqual({ id: catalogSong.id, title: catalogSong.title, published: true });
  });

  it("ajustes editoriais valem só para o catálogo; aprovar só metadados não publica a cifra", async () => {
    const song = await personalSong(userA);
    const submission = await submitted(userA, body(song.id, { rights: { status: "third-party", accepted: true } }));

    const refused = await approve(admin, submission.id, submission.revision, approveNew());
    expect(refused.status).toBe(400);
    expect(await CatalogSongModel.countDocuments({})).toBe(0);

    const { catalogSong } = await approved(
      submission.id,
      submission.revision,
      approveNew({ publishContent: false, editorial: { title: "[TESTE] Título Revisado", artist: "Compositora Fictícia", originalKey: "E" } }),
    );
    expect(catalogSong).toMatchObject({ contentType: "metadata-only", title: "[TESTE] Título Revisado", originalKey: "E", rights: { basis: "public-metadata", displayChordPro: false } });
    expect(catalogSong).not.toHaveProperty("chordPro");
    expect((await publicView(catalogSong.id)).song).not.toHaveProperty("chordPro");
    expect((await SongModel.findOne({ id: song.id }).lean())?.title).toBe(song.title);
  });

  it("sem crédito autorizado, nada de nome público; o nome da conta nunca é usado", async () => {
    const song = await personalSong(userA);
    const submission = await submitted(userA, body(song.id, { credit: { show: false } }));
    expect((await approve(admin, submission.id, submission.revision, approveNew())).status).toBe(400);
    const { catalogSong } = await approved(submission.id, submission.revision, approveNew({ creditName: null }));
    expect((await publicView(catalogSong.id)).song).not.toHaveProperty("contributorCredit");
    expect(JSON.stringify(catalogSong)).not.toContain("colaboradora-a");
  });

  it("aprovação repetida com o mesmo pedido devolve o mesmo resultado; uma aprovada não volta à fila", async () => {
    const song = await personalSong(userA);
    const submission = await submitted(userA, body(song.id));
    const payload = approveNew();
    const first = await approved(submission.id, submission.revision, payload);
    // Resposta perdida: o mesmo pedido, com a revisão antiga, não cria outra música.
    const retry = await approve(admin, submission.id, submission.revision, payload);
    expect(retry.status).toBe(200);
    expect((await json<{ catalogSong: CatalogSong }>(retry)).catalogSong.id).toBe(first.catalogSong.id);
    expect(await CatalogSongModel.countDocuments({})).toBe(1);

    const other = await approve(admin, submission.id, first.submission.revision, approveNew());
    expect(other.status).toBe(409);
    const reject = await adminRejectRoute.POST(request(admin, "POST", { note: "x" }, first.submission.revision), params({ id: submission.id }));
    expect(reject.status).toBe(409);
    const withdraw = await withdrawRoute.POST(request(userA, "POST", undefined, first.submission.revision), params({ id: submission.id }));
    expect(withdraw.status).toBe(409);
  });

  it("vídeo só entra com a conferência da administração", async () => {
    const song = await personalSong(userA);
    const submission = await submitted(userA, body(song.id));
    expect((await approve(admin, submission.id, submission.revision, approveNew({ videoVerified: false }))).status).toBe(400);
    const { catalogSong } = await approved(submission.id, submission.revision, approveNew({ includeVideo: false }));
    expect(catalogSong).not.toHaveProperty("video");
  });
});

describe("pedidos de correção, reenvio, recusa e retirada", () => {
  it("correções pedidas: a colaboradora edita a música e envia nova versão, com a anterior guardada", async () => {
    const song = await personalSong(userA);
    const submission = await submitted(userA, body(song.id));
    const changes = await adminChangesRoute.POST(
      request(admin, "POST", { note: "Corrija o tom." }, submission.revision),
      params({ id: submission.id }),
    );
    expect(changes.status).toBe(200);
    const pending = (await json<{ submission: AdminSubmission }>(changes)).submission;
    expect(pending.status).toBe("needs_changes");

    // Pedido de correções não se aprova sem nova versão.
    expect((await approve(admin, submission.id, pending.revision, approveNew())).status).toBe(409);

    await latest(createLibraryService(userA.id)).songs.update(song.id, {
      title: song.title,
      artist: song.artist,
      originalKey: "E",
      contentType: "original",
      chordPro: "[E]Vinde todos, versão corrigida",
    });
    const { songId: _songId, ...resubmission } = body(song.id);
    void _songId;
    const resubmitted = await resubmitRoute.POST(request(userA, "POST", resubmission, pending.revision), params({ id: submission.id }));
    expect(resubmitted.status).toBe(200);
    const second = (await json<{ submission: MySubmission }>(resubmitted)).submission;
    expect(second).toMatchObject({ status: "pending", version: 2, snapshot: { originalKey: "E" } });
    expect(second.previousVersions).toEqual([expect.objectContaining({ version: 1, snapshot: expect.objectContaining({ originalKey: "D" }) })]);
    expect(second.history.map((entry) => entry.action)).toEqual(["submitted", "request_changes", "resubmit"]);
    expect(second.reviewNote).toBeUndefined();

    // Repetir o reenvio (resposta perdida) não cria versão 3.
    const repeated = await resubmitRoute.POST(request(userA, "POST", resubmission, pending.revision), params({ id: submission.id }));
    expect(repeated.status).toBe(200);
    expect((await json<{ submission: MySubmission }>(repeated)).submission.version).toBe(2);
  });

  it("recusa é final e mostra a justificativa à colaboradora", async () => {
    const song = await personalSong(userA);
    const submission = await submitted(userA, body(song.id));
    const rejected = await adminRejectRoute.POST(request(admin, "POST", { note: "Já existe no hinário." }, submission.revision), params({ id: submission.id }));
    expect(rejected.status).toBe(200);
    const mine = await json<{ submission: MySubmission }>(await mySubmissionRoute.GET(request(userA, "GET"), params({ id: submission.id })));
    expect(mine.submission).toMatchObject({ status: "rejected", reviewNote: "Já existe no hinário." });
    expect(JSON.stringify(mine.submission)).not.toContain(admin.id);
    // Sem justificativa, não há decisão.
    const song2 = await personalSong(userA, { title: "[TESTE] Outro canto" });
    const other = await submitted(userA, body(song2.id));
    expect((await adminRejectRoute.POST(request(admin, "POST", { note: " " }, other.revision), params({ id: other.id }))).status).toBe(400);
  });

  it("retirar exige a revisão, tira da fila e descarta a cifra enviada", async () => {
    const song = await personalSong(userA);
    const submission = await submitted(userA, body(song.id));
    expect((await withdrawRoute.POST(request(userA, "POST"), params({ id: submission.id }))).status).toBe(428);
    expect((await withdrawRoute.POST(request(userA, "POST", undefined, 9), params({ id: submission.id }))).status).toBe(412);
    const response = await withdrawRoute.POST(request(userA, "POST", undefined, submission.revision), params({ id: submission.id }));
    expect(response.status).toBe(200);
    const document = await CatalogSubmissionModel.findOne({ id: submission.id }).lean();
    expect(document?.status).toBe("withdrawn");
    expect(document?.snapshot.chordPro).toBeUndefined();
    expect(document?.snapshot.title).toBe(song.title);

    const queue = await json<{ submissions: { id: string }[] }>(await adminQueueRoute.GET(request(admin, "GET", undefined, undefined, `${ORIGIN}/api/v1/x?status=pending`), params({})));
    expect(queue.submissions).toEqual([]);
  });
});

describe("exclusão da música particular", () => {
  it("a proposta guarda a própria cópia; o reenvio explica que a música foi excluída; a oficial não é apagada", async () => {
    const library = latest(createLibraryService(userA.id));
    const song = await personalSong(userA);
    const submission = await submitted(userA, body(song.id));
    await library.songs.delete(song.id);

    const mine = await json<{ submission: MySubmission }>(await mySubmissionRoute.GET(request(userA, "GET"), params({ id: submission.id })));
    expect(mine.submission.snapshot.chordPro).toBe(song.chordPro);

    const changes = await adminChangesRoute.POST(request(admin, "POST", { note: "Ajuste." }, submission.revision), params({ id: submission.id }));
    const { submission: needsChanges } = await json<{ submission: AdminSubmission }>(changes);
    const { songId: _ignored, ...resubmission } = body(song.id);
    void _ignored;
    const response = await resubmitRoute.POST(request(userA, "POST", resubmission, needsChanges.revision), params({ id: submission.id }));
    expect(response.status).toBe(404);
    expect((await json<{ error: { message: string } }>(response)).error.message).toContain("foi excluída");

    // Aprovada antes da exclusão: a música oficial continua.
    const song2 = await personalSong(userA, { title: "[TESTE] Canto aprovado" });
    const second = await submitted(userA, body(song2.id));
    const { catalogSong } = await approved(second.id, second.revision, approveNew({ editorial: { title: "[TESTE] Canto aprovado", artist: "Compositora Fictícia" } }));
    await library.songs.delete(song2.id);
    expect((await publicView(catalogSong.id)).status).toBe(200);
  });
});

describe("cenário C: duplicatas", () => {
  async function existing(): Promise<CatalogSong> {
    const song = await personalSong(userA);
    const submission = await submitted(userA, body(song.id, { video: null }));
    return (await approved(submission.id, submission.revision, approveNew({ includeVideo: false }))).catalogSong;
  }

  it("mesma música exige justificativa; mesmo título com outra autoria não", async () => {
    const official = await existing();
    const duplicate = await personalSong(userB, { title: "[teste]  canto da contribuicao!", artist: "COMPOSITORA FICTÍCIA" });

    const preview = await json<{ preview: { duplicates: { id: string; kind: string }[] } }>(
      await previewRoute.GET(request(userB, "GET", undefined, undefined, `${ORIGIN}/api/v1/x?songId=${duplicate.id}`), params({})),
    );
    expect(preview.preview.duplicates).toEqual([expect.objectContaining({ id: official.id, kind: "same-song" })]);

    const blocked = await submit(userB, body(duplicate.id));
    expect(blocked.status).toBe(409);
    expect((await json<{ error: { reason: string } }>(blocked)).error.reason).toBe("submission-duplicates");
    expect((await submit(userB, body(duplicate.id, { duplicateJustification: "Sugiro um vídeo para a mesma música." }))).status).toBe(201);

    const sameTitle = await personalSong(userB, { title: official.title, artist: "Outro Autor" });
    expect((await submit(userB, body(sameTitle.id))).status).toBe(201);
  });

  it("vinculada a uma existente: nenhum segundo registro global; título e cifra oficiais não mudam", async () => {
    const official = await existing();
    const duplicate = await personalSong(userB, { chordPro: "[A]Cifra alternativa" });
    const submission = await submitted(userB, body(duplicate.id, { duplicateJustification: "Vídeo para a mesma música." }));

    // Aprovar como nova sem ter visto a duplicata é barrado na transação.
    expect((await approve(admin, submission.id, submission.revision, approveNew())).status).toBe(409);

    const response = await approve(admin, submission.id, submission.revision, {
      mode: "complement",
      requestId: crypto.randomUUID(),
      targetCatalogSongId: official.id,
      targetRevision: official.revision,
      includeClassification: false,
      includeVideo: true,
      videoVerified: true,
      duplicatesChecked: true,
    });
    expect(response.status).toBe(200);
    const { catalogSong, submission: decided } = await json<{ catalogSong: CatalogSong; submission: AdminSubmission }>(response);
    expect(await CatalogSongModel.countDocuments({})).toBe(1);
    expect(decided).toMatchObject({ status: "approved", resultingCatalogSongId: official.id, review: { mode: "complement" } });
    expect(catalogSong).toMatchObject({ id: official.id, revision: official.revision + 1, title: official.title, chordPro: official.chordPro, rights: official.rights });
    expect(catalogSong.video?.videoId).toBe("abcdefghijk");
    expect(catalogSong.contributions?.map((entry) => entry.mode)).toEqual(["new", "complement"]);
    // O crédito público continua sendo só o de quem criou a música.
    expect((await publicView(official.id)).song?.contributorCredit).toBe("Grupo Fictício de Canto");
  });

  it("complemento não substitui classificação conferida nem vídeo existente; respeita a revisão do destino", async () => {
    const official = await existing();
    await CatalogSongModel.updateOne({ id: official.id }, { $set: { "liturgy.reviewStatus": "reviewed", "liturgy.review": { by: admin.id, at: new Date(), source: "[TESTE]" } } });
    const fresh = (await CatalogSongModel.findOne({ id: official.id }).lean())!;
    const duplicate = await personalSong(userB);
    const submission = await submitted(userB, body(duplicate.id, { duplicateJustification: "Complemento." }));
    const complement = (fields: Record<string, unknown>) => ({
      mode: "complement",
      requestId: crypto.randomUUID(),
      targetCatalogSongId: official.id,
      targetRevision: fresh.revision,
      includeClassification: false,
      includeVideo: false,
      duplicatesChecked: true,
      ...fields,
    });
    expect((await approve(admin, submission.id, submission.revision, complement({ includeClassification: true }))).status).toBe(400);
    expect((await approve(admin, submission.id, submission.revision, complement({ targetRevision: fresh.revision + 1 }))).status).toBe(412);
    const after = (await CatalogSongModel.findOne({ id: official.id }).lean())!;
    expect(after.revision).toBe(fresh.revision);
    expect(after.liturgy?.reviewStatus).toBe("reviewed");
  });

  it("a colaboradora não vê rascunhos da administração como duplicatas", async () => {
    await adminSongsRoute.POST(
      request(admin, "POST", {
        song: { title: "[TESTE] Canto da Contribuição", artist: "", contentType: "metadata-only" },
        rights: { basis: "public-metadata", evidence: "", displayChordPro: false, shareChordPro: false },
      }),
      params({}),
    );
    const song = await personalSong(userA);
    const preview = await json<{ preview: { duplicates: unknown[] } }>(
      await previewRoute.GET(request(userA, "GET", undefined, undefined, `${ORIGIN}/api/v1/x?songId=${song.id}`), params({})),
    );
    expect(preview.preview.duplicates).toEqual([]);
    const submission = await submitted(userA, body(song.id));
    // A administração vê o rascunho na análise.
    const adminView = await json<{ submission: AdminSubmission }>(await adminSubmissionRoute.GET(request(admin, "GET"), params({ id: submission.id })));
    expect(adminView.submission.duplicates).toHaveLength(1);
    expect(adminView.submission.submittedBy).toMatchObject({ id: userA.id, email: userA.email });
  });
});

describe("cenário D: concorrência", () => {
  it("duas pessoas aprovam ao mesmo tempo: uma aprovação, uma música", async () => {
    const song = await personalSong(userA);
    const submission = await submitted(userA, body(song.id));
    const responses = await Promise.all([
      approve(admin, submission.id, submission.revision, approveNew()),
      approve(admin2, submission.id, submission.revision, approveNew()),
    ]);
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses[0]).toBe(200);
    expect([409, 412]).toContain(statuses[1]);
    expect(await CatalogSongModel.countDocuments({})).toBe(1);
    const document = await CatalogSubmissionModel.findOne({ id: submission.id }).lean();
    expect(document?.history.filter((entry) => entry.action === "approve")).toHaveLength(1);
  });

  it("limite de pendentes vale mesmo com envios simultâneos", async () => {
    vi.stubEnv("CONTRIBUTION_MAX_PENDING", "2");
    const songs = await Promise.all([0, 1, 2, 3].map((index) => personalSong(userA, { title: `[TESTE] Canto ${index}` })));
    const responses = await Promise.all(songs.map((song) => submit(userA, body(song.id))));
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(2);
    expect(statuses.filter((status) => status === 429)).toHaveLength(2);
    expect(await CatalogSubmissionModel.countDocuments({ submittedBy: userA.id, status: "pending" })).toBe(2);
  });

  it("limite diário e tamanho da cifra, conferidos no servidor", async () => {
    vi.stubEnv("CONTRIBUTION_MAX_PER_DAY", "1");
    const [first, second] = await Promise.all([personalSong(userA), personalSong(userA, { title: "[TESTE] Segundo" })]);
    await submitted(userA, body(first.id));
    const daily = await submit(userA, body(second.id));
    expect(daily.status).toBe(429);
    expect((await json<{ error: { reason: string } }>(daily)).error.reason).toBe("submission-daily-limit");

    vi.stubEnv("CONTRIBUTION_MAX_CHORDPRO_LENGTH", "10");
    const big = await personalSong(userB);
    expect((await submit(userB, body(big.id))).status).toBe(413);
  });
});

describe("cenário E: privacidade", () => {
  it("outra conta não lê, não retira nem reenvia; visitante não acessa; usuário comum não entra na fila", async () => {
    const song = await personalSong(userA);
    const submission = await submitted(userA, body(song.id));
    const id = submission.id;

    expect((await mySubmissionRoute.GET(request(userB, "GET"), params({ id }))).status).toBe(404);
    expect((await withdrawRoute.POST(request(userB, "POST", undefined, submission.revision), params({ id }))).status).toBe(404);
    const mine = await json<{ submissions: unknown[] }>(await mineRoute.GET(request(userB, "GET"), params({})));
    expect(mine.submissions).toEqual([]);
    // A música particular de outra conta não serve de origem.
    expect((await submit(userB, body(song.id))).status).toBe(404);
    expect((await previewRoute.GET(request(userB, "GET", undefined, undefined, `${ORIGIN}/api/v1/x?songId=${song.id}`), params({}))).status).toBe(404);

    expect((await mineRoute.GET(request(null, "GET"), params({}))).status).toBe(401);
    expect((await submissionsRoute.POST(request(null, "POST", body(song.id)), params({}))).status).toBe(401);
    expect((await adminQueueRoute.GET(request(userA, "GET"), params({}))).status).toBe(403);
    expect((await adminSubmissionRoute.GET(request(userB, "GET"), params({ id }))).status).toBe(403);
    expect((await approve(userB, id, submission.revision, approveNew())).status).toBe(403);

    // Proposta pendente não aparece em nenhuma rota pública.
    const results = await search("Contribuição");
    expect(results.total).toBe(0);
    expect(JSON.stringify(results)).not.toContain(userA.email);
  });

  it("campos fora do contrato são recusados; o dono vem da sessão", async () => {
    const song = await personalSong(userA);
    const response = await submit(userA, { ...body(song.id), submittedBy: userB.id } as SubmissionRequest);
    expect(response.status).toBe(400);
    const status = await submit(userA, { ...body(song.id), status: "approved" } as SubmissionRequest);
    expect(status.status).toBe(400);
  });

  it("quem enviou não aprova a própria contribuição", async () => {
    const song = await personalSong(admin);
    const submission = await submitted(admin, body(song.id));
    expect((await approve(admin, submission.id, submission.revision, approveNew())).status).toBe(403);
    expect((await approve(admin2, submission.id, submission.revision, approveNew())).status).toBe(200);
  });
});

describe("cenário F: vídeo", () => {
  it("só link do YouTube; nada de HTML ou iframe; o catálogo guarda provedor e identificador", async () => {
    const song = await personalSong(userA);
    for (const url of ['<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe>', "https://vimeo.com/1", "http://youtu.be/abcdefghijk"]) {
      expect((await submit(userA, body(song.id, { video: { url } }))).status).toBe(400);
    }
    const submission = await submitted(userA, body(song.id, { video: { url: "https://www.youtube.com/shorts/abcdefghijk", title: "Ensaio" } }));
    const { catalogSong } = await approved(submission.id, submission.revision);
    const view = (await publicView(catalogSong.id)).song!;
    expect(view.video).toEqual({ provider: "youtube", videoId: "abcdefghijk", title: "Ensaio" });
    expect(JSON.stringify(view)).not.toMatch(/iframe|<|embed/);

    // Retirada (contestação): vídeo e crédito saem com a revisão esperada.
    const removal = await removalRoute.POST(request(admin, "POST", { video: true, credit: true }, catalogSong.revision), params({ id: catalogSong.id }));
    expect(removal.status).toBe(200);
    const after = (await publicView(catalogSong.id)).song!;
    expect(after).not.toHaveProperty("video");
    expect(after).not.toHaveProperty("contributorCredit");
    expect((await removalRoute.POST(request(userA, "POST", { video: true, credit: false }, catalogSong.revision + 1), params({ id: catalogSong.id }))).status).toBe(403);
  });
});

describe("cenário G: repertórios e compartilhamentos preservados", () => {
  it("enviar e aprovar não mexem no repertório; a música oficial entra como item do catálogo e o link funciona", async () => {
    const library = latest(createLibraryService(userA.id));
    const song = await personalSong(userA);
    const repertoire = await library.repertoires.create({ name: "[TESTE] Missa", description: "" });
    let current = await library.repertoires.addSong(repertoire.id, song.id);
    current = await library.repertoires.updateItem(current.id, current.items[0]!.id, { transposeSemitones: 2, notes: "NOTA PRIVADA" });

    const submission = await submitted(userA, body(song.id));
    const { catalogSong } = await approved(submission.id, submission.revision);

    const after = await createLibraryService(userA.id).repertoires.findById(current.id);
    expect(after).toEqual(current);
    expect(after?.items[0]).toMatchObject({ source: "personal", songId: song.id, transposeSemitones: 2, notes: "NOTA PRIVADA" });

    const withCatalog = await library.repertoires.addSong(current.id, catalogSong.id, "catalog");
    expect(withCatalog.items.map((item) => item.source)).toEqual(["personal", "catalog"]);

    const shares = createLibraryService(userA.id).shares;
    const selection: ShareSelection = { authorizations: [{ songId: song.id, confirmed: true, declarationVersion: SHARE_DECLARATION }] };
    const { contentHash } = await shares.preview(current.id, selection);
    const share = await shares.create(current.id, { ...selection, expectedHash: contentHash });
    const token = share.path!.replace("/s/", "");
    const open = await publicShareRoute.GET(new Request(`${ORIGIN}/api/v1/public/shares/${token}`), params({ token }));
    expect(open.status).toBe(200);
    const shared = await json<{ share: { items: { title: string; content: { kind: string } }[] } }>(open);
    expect(shared.share.items.map((item) => item.content.kind)).toEqual(["chordpro", "none"]);
    // Sem licença de redistribuição aplicada, a cifra do catálogo não vai no link.
    expect(JSON.stringify(shared)).not.toContain(catalogSong.chordPro!);

    await shares.revoke(current.id, share.id);
    expect((await publicShareRoute.GET(new Request(`${ORIGIN}/api/v1/public/shares/${token}`), params({ token }))).status).toBe(404);

    // Visitante encontra a música oficial; a particular continua privada.
    expect((await publicView(catalogSong.id)).status).toBe(200);
    expect((await publicView(song.id)).status).toBe(404);
  });
});
