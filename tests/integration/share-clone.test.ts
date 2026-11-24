import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as cloneRoute from "@/app/api/v1/library/shares/clone/route";
import * as publicRoute from "@/app/api/v1/public/shares/[token]/route";
import { RIGHTS_DECLARATION_VERSION, type ShareSelection, type ShareSummary } from "@/features/sharing/domain/public-share";
import { createCatalogAdminService } from "@/server/catalog/catalog-service";
import { CatalogSongModel } from "@/server/database/models/catalog-song-model";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { SongModel } from "@/server/database/models/song-model";
import { resetRateLimitsForTests } from "@/server/http/rate-limit";
import { createLibraryService, type LibraryService } from "@/server/library/library-service";
import { latest } from "@/test/latest-revision";

import { clearDatabase, createTestUser, dropTestDatabase, externalSong, hostedSong, ORIGIN, type TestUser } from "./helpers";

let owner: TestUser;
let recipient: TestUser;
let library: LibraryService;
let mine: LibraryService;
const hosted = { title: hostedSong.title, artist: hostedSong.artist, originalKey: hostedSong.originalKey, contentType: "original" as const, chordPro: hostedSong.chordPro };

beforeEach(async () => {
  vi.stubEnv("PUBLIC_SHARING_ENABLED", "true");
  vi.stubEnv("SHARE_LINK_SECRET", "segredo-de-compartilhamento-apenas-para-teste-local");
  resetRateLimitsForTests();
  await clearDatabase();
  owner = await createTestUser("origem"); recipient = await createTestUser("destino");
  library = createLibraryService(owner.id); mine = createLibraryService(recipient.id);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
afterAll(dropTestDatabase);

function tokenOf(share: ShareSummary) { return share.path!.slice(3); }
function clone(token: string, requestId = crypto.randomUUID(), user: TestUser | null = recipient, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return cloneRoute.POST(new Request(`${ORIGIN}/api/v1/library/shares/clone`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", ...(user ? { cookie: user.cookie, "x-repertorio-expected-user": user.id } : {}), ...headers },
    body: JSON.stringify({ token, requestId, ...extra }),
  }), { params: Promise.resolve({}) });
}
function open(token: string) {
  return publicRoute.GET(new Request(`${ORIGIN}/api/v1/public/shares/${token}`), { params: Promise.resolve({ token }) });
}
async function publish(id: string, authorized: string[] = [], includeMassDate = true) {
  const selection: ShareSelection = { authorizations: authorized.map(songId => ({ songId, confirmed: true, declarationVersion: RIGHTS_DECLARATION_VERSION })), includeMassDate };
  const preview = await library.shares.preview(id, selection);
  return library.shares.create(id, { ...selection, expectedHash: preview.contentHash });
}
async function setup(includeMassDate = true) {
  const a = await library.songs.create(hosted);
  const b = await library.songs.create({ ...hosted, title: "Sem autorização pública", chordPro: "[G]TEXTO PRIVADO" });
  const c = await library.songs.create(externalSong);
  const repertoire = await library.repertoires.create({ name: "Missa compartilhada", description: "Descrição publicada", mass: { date: "2026-11-29", title: "1º Domingo do Advento", celebrationId: "celebracao-privada", celebrationRevision: 1 } });
  await latest(library).repertoires.addSong(repertoire.id, a.id, "personal", "entrada");
  await latest(library).repertoires.addSong(repertoire.id, b.id, "personal", "comunhao");
  const full = await latest(library).repertoires.addSong(repertoire.id, c.id, "personal", "encerramento");
  await latest(library).repertoires.updateItem(repertoire.id, full.items[0].id, { transposeSemitones: 2, notes: "ANOTAÇÃO PRIVADA" });
  return { a, b, c, repertoire: (await library.repertoires.findById(repertoire.id))!, share: await publish(repertoire.id, [a.id], includeMassDate) };
}

describe("leitura pública e cópia para outra conta", () => {
  it("abre sem cookie, com nome, músicas e cifra publicada, sem dados privados", async () => {
    const { share } = await setup();
    const response = await open(tokenOf(share));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(text).toContain("Missa compartilhada");
    expect(text).not.toContain("TEXTO PRIVADO");
    expect(text).not.toContain("ANOTAÇÃO PRIVADA");
    expect(text).not.toContain(owner.id);
    expect(text).not.toContain("celebracao-privada");
  });

  it("clona na conta da sessão, preservando ordem, tons, momentos e só a data pública", async () => {
    const { a, b, c, repertoire, share } = await setup();
    const response = await clone(tokenOf(share));
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("private");
    const result = await response.json();
    expect(result.skippedItems).toBe(0);
    expect(result.repertoire).toMatchObject({ name: repertoire.name, description: repertoire.description, revision: 1, mass: { date: "2026-11-29", title: "1º Domingo do Advento" } });
    expect(result.repertoire.mass).not.toHaveProperty("celebrationId");
    expect(result.repertoire.id).not.toBe(repertoire.id);
    expect(result.repertoire.items.map((item: { position: number; moment: string; transposeSemitones: number }) => [item.position, item.moment, item.transposeSemitones])).toEqual([[1, "entrada", 2], [2, "comunhao", 0], [3, "encerramento", 0]]);
    const songs = await mine.songs.list();
    expect(songs).toHaveLength(3);
    expect(songs.find(song => song.title === a.title)).toMatchObject({ contentType: "authorized", chordPro: a.chordPro });
    expect(songs.find(song => song.title === b.title)).not.toHaveProperty("chordPro");
    expect(songs.find(song => song.title === c.title)).toMatchObject({ contentType: "external-link", sourceUrl: c.sourceUrl });
    expect(songs.some(song => [a.id, b.id, c.id].includes(song.id))).toBe(false);
    expect(JSON.stringify(result)).not.toContain("ANOTAÇÃO PRIVADA");
    expect(await library.repertoires.findById(repertoire.id)).toEqual(repertoire);
    expect(await library.repertoires.findById(result.repertoire.id)).toBeNull();
    await mine.repertoires.update(result.repertoire.id, { name: "Minha edição", description: "" }, 1);
    expect((await library.repertoires.findById(repertoire.id))?.name).toBe(repertoire.name);
  });

  it("não busca a data omitida nem a cifra privada e usa a versão publicada", async () => {
    const { a, share } = await setup(false);
    await library.songs.update(a.id, { ...hosted, title: "Alteração privada posterior", chordPro: "[G]VERSÃO PRIVADA POSTERIOR" }, a.revision);
    const response = await clone(tokenOf(share));
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.repertoire).not.toHaveProperty("mass");
    const copied = await mine.songs.list();
    expect(JSON.stringify(copied)).not.toContain("VERSÃO PRIVADA POSTERIOR");
    expect(copied.find(song => song.title === a.title)?.chordPro).toBe(a.chordPro);
  });

  it("requisições repetidas e simultâneas da mesma tentativa criam só uma cópia", async () => {
    const { share } = await setup();
    const requestId = crypto.randomUUID();
    const responses = await Promise.all([clone(tokenOf(share), requestId), clone(tokenOf(share), requestId)]);
    expect(responses.map(response => response.status)).toEqual([201, 201]);
    const results = await Promise.all(responses.map(response => response.json()));
    expect(results[0].repertoire.id).toBe(results[1].repertoire.id);
    expect((await mine.repertoires.list()).length).toBe(1);
    expect((await mine.songs.list()).length).toBe(3);
  });

  it("falha na gravação desfaz as músicas e permite repetir a tentativa", async () => {
    const { share } = await setup();
    const requestId = crypto.randomUUID();
    vi.spyOn(RepertoireModel, "create").mockRejectedValueOnce(new Error("Falha simulada"));
    expect((await clone(tokenOf(share), requestId)).status).toBe(503);
    expect(await SongModel.countDocuments({ ownerId: recipient.id })).toBe(0);
    expect(await RepertoireModel.countDocuments({ ownerId: recipient.id })).toBe(0);
    expect((await clone(tokenOf(share), requestId)).status).toBe(201);
    expect((await mine.songs.list()).length).toBe(3);
  });

  it("exige login para salvar e recusa dono forjado, troca de conta e origem externa", async () => {
    const { share } = await setup(); const token = tokenOf(share);
    expect((await clone(token, crypto.randomUUID(), null)).status).toBe(401);
    expect((await clone(token, crypto.randomUUID(), recipient, { ownerId: owner.id })).status).toBe(400);
    expect((await clone(token, crypto.randomUUID(), recipient, {}, { "x-repertorio-expected-user": owner.id })).status).toBe(409);
    expect((await clone(token, crypto.randomUUID(), recipient, {}, { origin: "https://evil.example" })).status).toBe(403);
    expect(await mine.repertoires.list()).toEqual([]);
  });

  it("link revogado, adulterado e recurso desligado não permitem novas cópias", async () => {
    const { share } = await setup(); const token = tokenOf(share);
    expect((await clone(`${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`)).status).toBe(404);
    vi.stubEnv("PUBLIC_SHARING_ENABLED", "false");
    expect((await clone(token)).status).toBe(404);
    vi.stubEnv("PUBLIC_SHARING_ENABLED", "true");
    await library.shares.revoke(share.repertoireId, share.id);
    expect((await clone(token)).status).toBe(404);
    expect((await open(token)).status).toBe(404);
    expect(await mine.repertoires.list()).toEqual([]);
  });

  it("revogar o link preserva uma cópia já salva", async () => {
    const { share } = await setup();
    const response = await clone(tokenOf(share)); const result = await response.json();
    await library.shares.revoke(share.repertoireId, share.id);
    expect((await open(tokenOf(share))).status).toBe(404);
    expect(await mine.repertoires.findById(result.repertoire.id)).not.toBeNull();
  });

  it("mantém referências do catálogo, inclusive metadados sem tom, sem duplicar cifras globais", async () => {
    const { repertoire, a } = await setup();
    const admin = createCatalogAdminService("editor-de-teste");
    const draft = await admin.create({ song: { title: "Música do catálogo", artist: "", contentType: "metadata-only" }, metadataSources: [{ title: "Fonte fictícia" }], rights: { basis: "public-metadata", evidence: "Metadados fictícios de teste", displayChordPro: false, shareChordPro: false } });
    const catalog = await admin.publish(draft.id, draft.revision);
    await latest(library).repertoires.addSong(repertoire.id, catalog.id, "catalog", "comunhao");
    const share = await publish(repertoire.id, [a.id]);
    const response = await clone(tokenOf(share)); expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.repertoire.items).toContainEqual(expect.objectContaining({ songId: catalog.id, source: "catalog" }));
    expect(await mine.songs.list()).toHaveLength(3);
    await CatalogSongModel.updateOne({ id: catalog.id }, { $set: { status: "unpublished" } });
    const partial = await clone(tokenOf(share)); expect(partial.status).toBe(201);
    const reduced = await partial.json();
    expect(reduced.skippedItems).toBe(1);
    expect(reduced.repertoire.items).toHaveLength(3);
  });
});
