import { afterAll, beforeEach, describe, expect, it } from "vitest";

import * as publishRoute from "@/app/api/v1/admin/catalog/songs/[id]/publish/route";
import * as classificationRoute from "@/app/api/v1/admin/catalog/songs/[id]/classification/route";
import * as songRoute from "@/app/api/v1/admin/catalog/songs/[id]/route";
import * as songsRoute from "@/app/api/v1/admin/catalog/songs/route";
import * as publicSongRoute from "@/app/api/v1/catalog/songs/[id]/route";
import type { CatalogSong } from "@/features/catalog/domain/catalog-song";
import { EMPTY_CLASSIFICATION_INPUT } from "@/features/liturgy/domain/classification";
import { listSuggestionCandidates, searchCatalog } from "@/server/catalog/catalog-service";
import { CatalogAdminModel } from "@/server/database/models/catalog-admin-model";
import { CatalogSongModel } from "@/server/database/models/catalog-song-model";

import { clearDatabase, createTestUser, dropTestDatabase, ORIGIN, type TestUser } from "./helpers";

let admin: TestUser;
let musician: TestUser;
let song: CatalogSong;
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const INPUT = {
  song: { title: "[TESTE] Canto sem cifra", artist: "", contentType: "metadata-only" },
  rights: { basis: "public-metadata", evidence: "Fonte fictícia de teste.", displayChordPro: false, shareChordPro: false },
  metadataSources: [{ title: "Fonte fictícia", url: "https://example.com/fonte" }],
};

function request(user: TestUser | null, video: unknown, revision: number | null = song.revision, origin = ORIGIN) {
  return new Request(`${ORIGIN}/api/v1/admin/catalog/songs/${song.id}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json", origin,
      ...(user ? { cookie: user.cookie, "x-repertorio-expected-user": user.id } : {}),
      ...(revision === null ? {} : { "if-match": `"${revision}"` }),
    },
    body: JSON.stringify({ ...INPUT, ...(video === undefined ? {} : { video }) }),
  });
}

async function update(video: unknown, revision = song.revision) {
  const response = await songRoute.PUT(request(admin, video, revision), params(song.id));
  expect(response.status).toBe(200);
  song = (await response.json()).song;
  return response;
}

beforeEach(async () => {
  await clearDatabase();
  admin = await createTestUser("admin-video");
  musician = await createTestUser("musico-video");
  await CatalogAdminModel.create({ userId: admin.id, grantedAt: new Date(), grantedBy: "teste-local" });
  const response = await songsRoute.POST(new Request(`${ORIGIN}/api/v1/admin/catalog/songs`, {
    method: "POST",
    headers: { cookie: admin.cookie, origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify(INPUT),
  }), { params: Promise.resolve({}) });
  expect(response.status).toBe(201);
  song = (await response.json()).song;
});

afterAll(dropTestDatabase);

describe("edição de vídeo pela administração do catálogo", () => {
  it("cria a música e o vídeo no mesmo pedido, sem exigir cifra, tom ou autoria", async () => {
    const response = await songsRoute.POST(new Request(`${ORIGIN}/api/v1/admin/catalog/songs`, {
      method: "POST", headers: { cookie: admin.cookie, origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ ...INPUT, video: { url: "https://youtu.be/abcdefghijk", title: "Ensaio", startSeconds: 45 } }),
    }), { params: Promise.resolve({}) });
    expect(response.status).toBe(201);
    const created = (await response.json()).song;
    expect(created).toMatchObject({ revision: 1, status: "draft", video: { videoId: "abcdefghijk", title: "Ensaio", startSeconds: 45, approvedBy: admin.id } });
    expect(created).not.toHaveProperty("originalKey");
    expect(created).not.toHaveProperty("chordPro");
  });

  it("salva só o identificador e registra a aprovação sem alterar música, direitos ou classificação", async () => {
    const before = structuredClone(song);
    const response = await update({ url: "https://youtu.be/abcdefghijk?t=10", title: " Ensaio " });
    expect(response.headers.get("etag")).toBe('"2"');
    expect(song.video).toEqual({ provider: "youtube", videoId: "abcdefghijk", title: "Ensaio", startSeconds: 10, kind: "reference", approvedBy: admin.id, approvedAt: expect.any(String) });
    expect(song).toMatchObject({ title: before.title, status: "draft", contentType: "metadata-only", rights: before.rights, liturgy: before.liturgy, metadataSources: before.metadataSources });
    expect(song).not.toHaveProperty("chordPro");
    expect(song).not.toHaveProperty("originalKey");
    const stored = await CatalogSongModel.findOne({ id: song.id }).lean();
    expect(JSON.stringify(stored?.video)).not.toContain("https://");
  });

  it("publica a referência sem dados administrativos e permite trocar e remover o vídeo", async () => {
    await update({ url: "https://www.youtube.com/shorts/abcdefghijk" });
    const published = await publishRoute.POST(new Request(`${ORIGIN}/api/v1/x`, {
      method: "POST", headers: { cookie: admin.cookie, origin: ORIGIN, "if-match": `"${song.revision}"` },
    }), params(song.id));
    expect(published.status).toBe(200);
    song = (await published.json()).song;
    const publicResponse = await publicSongRoute.GET(new Request(`${ORIGIN}/api/v1/catalog/songs/${song.id}`), params(song.id));
    expect((await publicResponse.json()).song.video).toEqual({ provider: "youtube", videoId: "abcdefghijk" });
    await update({ url: "https://www.youtube.com/watch?v=lmnopqrstuv" });
    expect(song.video?.videoId).toBe("lmnopqrstuv");
    await update(null);
    expect(song).not.toHaveProperty("video");
    expect(song.status).toBe("published");
    const after = await publicSongRoute.GET(new Request(`${ORIGIN}/api/v1/catalog/songs/${song.id}`), params(song.id));
    expect((await after.json()).song).not.toHaveProperty("video");
  });

  it("preserva a aprovação e a procedência ao salvar a mesma referência de uma contribuição", async () => {
    await CatalogSongModel.updateOne({ id: song.id }, { $set: { video: {
      provider: "youtube", videoId: "abcdefghijk", title: "Ensaio", kind: "performance",
      submissionId: "contribuicao-ficticia", approvedBy: "revisor-original", approvedAt: new Date("2026-11-01T12:00:00.000Z"),
    } } });
    await update({ url: "https://youtu.be/abcdefghijk", title: "Ensaio" });
    expect(song.video).toMatchObject({ kind: "performance", submissionId: "contribuicao-ficticia", approvedBy: "revisor-original", approvedAt: "2026-11-01T12:00:00.000Z" });
    await update({ url: "https://youtu.be/lmnopqrstuv" });
    expect(song.video?.approvedBy).toBe(admin.id);
    expect(song.video).not.toHaveProperty("submissionId");
  });

  it("recusa URLs inválidas, HTML e campos de aprovação forjados", async () => {
    for (const video of [
      { url: "http://youtu.be/abcdefghijk" }, { url: "https://youtube.com.evil.example/watch?v=abcdefghijk" },
      { url: "https://youtu.be/invalido" }, { url: '<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe>' },
      { url: "https://youtu.be/abcdefghijk", approvedBy: musician.id },
      { url: "https://youtu.be/abcdefghijk", title: "x".repeat(201) },
    ]) {
      expect((await songRoute.PUT(request(admin, video), params(song.id))).status).toBe(400);
    }
    expect((await CatalogSongModel.findOne({ id: song.id }).lean())?.revision).toBe(1);
  });

  it("exige sessão, papel administrativo, origem confiável e revisão atual", async () => {
    const video = { url: "https://youtu.be/abcdefghijk" };
    expect((await songRoute.PUT(request(null, video), params(song.id))).status).toBe(401);
    expect((await songRoute.PUT(request(musician, video), params(song.id))).status).toBe(403);
    expect((await songRoute.PUT(request(admin, video, song.revision, "https://example.com"), params(song.id))).status).toBe(403);
    expect((await songRoute.PUT(request(admin, video, null), params(song.id))).status).toBe(428);
    const staleRevision = song.revision;
    await update(video);
    expect((await songRoute.PUT(request(admin, null, staleRevision), params(song.id))).status).toBe(412);
    expect((await CatalogSongModel.findOne({ id: song.id }).lean())?.video?.videoId).toBe("abcdefghijk");
  });

  it("omitir o campo de vídeo em outro cliente preserva a referência existente", async () => {
    await update({ url: "https://youtu.be/abcdefghijk" });
    const approved = song.video;
    await update(undefined);
    expect(song.video).toEqual(approved);
  });

  it("preserva o início em clientes antigos, permite editar e voltar a zero", async () => {
    await update({ url: "https://youtu.be/abcdefghijk?t=1m30s" });
    expect(song.video?.startSeconds).toBe(90);
    const approved = song.video;
    await update({ url: "https://youtu.be/abcdefghijk" });
    expect(song.video).toEqual(approved);
    await update({ url: "https://youtu.be/abcdefghijk", startSeconds: 45 });
    expect(song.video?.startSeconds).toBe(45);
    await update({ url: "https://youtu.be/abcdefghijk?t=90", startSeconds: 0 });
    expect(song.video).not.toHaveProperty("startSeconds");
    await update({ url: "https://youtu.be/lmnopqrstuv" });
    expect(song.video).not.toHaveProperty("startSeconds");
  });

  it("exibe só os dados públicos do vídeo na busca, no detalhe e nas sugestões da Missa", async () => {
    await update({ url: "https://youtu.be/abcdefghijk", title: "Ensaio", startSeconds: 45 });
    expect((await searchCatalog({ page: 1, pageSize: 20, q: "" })).songs).toEqual([]);
    const published = await publishRoute.POST(new Request(`${ORIGIN}/api/v1/x`, {
      method: "POST", headers: { cookie: admin.cookie, origin: ORIGIN, "if-match": `"${song.revision}"` },
    }), params(song.id));
    expect(published.status).toBe(200);
    song = (await published.json()).song;
    const classified = await classificationRoute.PUT(new Request(`${ORIGIN}/api/v1/x`, {
      method: "PUT", headers: { cookie: admin.cookie, origin: ORIGIN, "content-type": "application/json", "if-match": `"${song.revision}"` },
      body: JSON.stringify({ liturgy: { ...EMPTY_CLASSIFICATION_INPUT, moments: ["entrada"] } }),
    }), params(song.id));
    expect(classified.status).toBe(200);
    const expected = { provider: "youtube", videoId: "abcdefghijk", title: "Ensaio", startSeconds: 45 };
    const detail = await publicSongRoute.GET(new Request(`${ORIGIN}/api/v1/catalog/songs/${song.id}`), params(song.id));
    expect(detail.status).toBe(200);
    expect((await detail.json()).song.video).toEqual(expected);
    expect((await searchCatalog({ page: 1, pageSize: 20, q: "" })).songs[0].video).toEqual(expected);
    expect((await listSuggestionCandidates(["entrada"]))[0].video).toEqual(expected);
  });

  it("recusa tempos negativos, fracionários, excessivos e números enviados como texto", async () => {
    for (const startSeconds of [-1, 1.5, 604801, "45", null]) {
      expect((await songRoute.PUT(request(admin, { url: "https://youtu.be/abcdefghijk", startSeconds }), params(song.id))).status).toBe(400);
    }
    expect((await CatalogSongModel.findOne({ id: song.id }).lean())?.revision).toBe(1);
  });

  it("um vídeo inválido recusa o cadastro inteiro, sem deixar rascunho parcial", async () => {
    const before = await CatalogSongModel.countDocuments();
    const response = await songsRoute.POST(new Request(`${ORIGIN}/api/v1/admin/catalog/songs`, {
      method: "POST", headers: { cookie: admin.cookie, origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ ...INPUT, video: { url: "https://example.com/invalido" } }),
    }), { params: Promise.resolve({}) });
    expect(response.status).toBe(400);
    expect(await CatalogSongModel.countDocuments()).toBe(before);
  });
});
