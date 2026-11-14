import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as adminSongRoute from "@/app/api/v1/admin/catalog/songs/[id]/route";
import * as adminPublishRoute from "@/app/api/v1/admin/catalog/songs/[id]/publish/route";
import * as adminUnpublishRoute from "@/app/api/v1/admin/catalog/songs/[id]/unpublish/route";
import * as adminSongsRoute from "@/app/api/v1/admin/catalog/songs/route";
import * as publicSongRoute from "@/app/api/v1/catalog/songs/[id]/route";
import * as publicSongsRoute from "@/app/api/v1/catalog/songs/route";
import * as exportRoute from "@/app/api/v1/library/export/route";
import * as itemsRoute from "@/app/api/v1/library/repertoires/[id]/items/route";
import * as repertoiresRoute from "@/app/api/v1/library/repertoires/route";
import * as songRoute from "@/app/api/v1/library/songs/[id]/route";
import * as publicShareRoute from "@/app/api/v1/public/shares/[token]/route";
import type { CatalogSong, CatalogSongInput } from "@/features/catalog/domain/catalog-song";
import type { Repertoire } from "@/features/repertoires/domain/repertoire";
import type { ShareSelection, ShareSummary } from "@/features/sharing/domain/public-share";
import { CatalogAdminModel } from "@/server/database/models/catalog-admin-model";
import { CatalogSongModel } from "@/server/database/models/catalog-song-model";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { resetRateLimitsForTests } from "@/server/http/rate-limit";
import { createLibraryService } from "@/server/library/library-service";
import { latest } from "@/test/latest-revision";

import { authRequest, clearDatabase, createTestUser, dropTestDatabase, hostedSong, ORIGIN, type TestUser } from "./helpers";

const run = promisify(execFile);
const SECRET = "chave-de-integracao-com-mais-de-32-caracteres";

let admin: TestUser;
let userA: TestUser;
let userB: TestUser;

/** Mesmo procedimento documentado: o comando local, contra o banco temporário desta suíte. */
async function adminCli(...args: string[]): Promise<string> {
  const { stdout } = await run(process.execPath, ["scripts/catalog-admin.mjs", ...args], {
    env: { ...process.env, MONGODB_URI: process.env.MONGODB_URI, MONGODB_DB_NAME: process.env.MONGODB_DB_NAME },
  });
  return stdout;
}

function request(user: TestUser | null, method: string, path: string, body?: unknown, revision?: number): Request {
  return new Request(`${ORIGIN}${path}`, {
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

function input(title: string, overrides: Partial<CatalogSongInput["song"]> = {}, rights: Partial<CatalogSongInput["rights"]> = {}): CatalogSongInput {
  return {
    song: { title, artist: "Banda Imaginária", originalKey: "G", contentType: "original", chordPro: `[G]Letra de ${title}`, ...overrides } as CatalogSongInput["song"],
    rights: { basis: "original-work", evidence: "Obra criada para os testes.", displayChordPro: true, shareChordPro: true, ...rights },
  };
}

async function adminCreate(body: CatalogSongInput, user = admin): Promise<Response> {
  return adminSongsRoute.POST(request(user, "POST", "/api/v1/admin/catalog/songs", body), params({}));
}

async function created(body: CatalogSongInput): Promise<CatalogSong> {
  const response = await adminCreate(body);
  expect(response.status).toBe(201);
  return ((await response.json()) as { song: CatalogSong }).song;
}

async function publish(song: CatalogSong, user = admin): Promise<Response> {
  return adminPublishRoute.POST(request(user, "POST", `/x/${song.id}/publish`, undefined, song.revision), params({ id: song.id }));
}

async function published(body: CatalogSongInput): Promise<CatalogSong> {
  const response = await publish(await created(body));
  expect(response.status).toBe(200);
  return ((await response.json()) as { song: CatalogSong }).song;
}

async function unpublish(song: CatalogSong): Promise<CatalogSong> {
  const response = await adminUnpublishRoute.POST(request(admin, "POST", "/x", undefined, song.revision), params({ id: song.id }));
  expect(response.status).toBe(200);
  return ((await response.json()) as { song: CatalogSong }).song;
}

async function search(query: string): Promise<{ status: number; body: { songs: Record<string, unknown>[]; total: number; totalPages: number; page: number } }> {
  const response = await publicSongsRoute.GET(new Request(`${ORIGIN}/api/v1/catalog/songs?${query}`), params({}));
  return { status: response.status, body: await response.json() };
}

async function publicSong(id: string): Promise<Response> {
  return publicSongRoute.GET(new Request(`${ORIGIN}/api/v1/catalog/songs/${id}`), params({ id }));
}

async function addItem(user: TestUser | null, repertoire: { id: string; revision: number }, songId: string, source?: string): Promise<Response> {
  return itemsRoute.POST(
    request(user, "POST", `/api/v1/library/repertoires/${repertoire.id}/items`, { songId, ...(source ? { source } : {}) }, repertoire.revision),
    params({ id: repertoire.id }),
  );
}

async function listRepertoires(user: TestUser): Promise<{ repertoires: Repertoire[]; catalogSongs: { id: string; chordPro?: string }[] }> {
  const response = await repertoiresRoute.GET(request(user, "GET", "/api/v1/library/repertoires"), params({}));
  expect(response.status).toBe(200);
  return response.json();
}

beforeEach(async () => {
  resetRateLimitsForTests();
  vi.stubEnv("PUBLIC_SHARING_ENABLED", "true");
  vi.stubEnv("SHARE_LINK_SECRET", SECRET);
  await clearDatabase();
  admin = await createTestUser("admin");
  userA = await createTestUser("usuaria-a");
  userB = await createTestUser("usuario-b");
  expect(await adminCli("grant", "--email", admin.email, "--note", "teste")).toContain("Papel concedido.");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(dropTestDatabase);

describe("cenário A: catálogo", () => {
  it("rascunho não aparece; publicada aparece na busca e na leitura pública", async () => {
    const draft = await created(input("Coração de Estrada"));
    expect(draft).toMatchObject({ status: "draft", revision: 1 });

    expect((await search("q=coracao")).body.total).toBe(0);
    expect((await publicSong(draft.id)).status).toBe(404);

    const response = await publish(draft);
    expect(response.status).toBe(200);

    const found = await search("q=CORACAO");
    expect(found.body.songs.map((song) => song.title)).toEqual(["Coração de Estrada"]);
    // A listagem não leva cifra, direitos nem evidência.
    // Desde a Etapa 2E.2 traz também os momentos e tempos da classificação, que são públicos.
    expect(Object.keys(found.body.songs[0]).sort()).toEqual([
      "artist",
      "contentType",
      "hasChordPro",
      "id",
      "moments",
      "originalKey",
      "seasons",
      "title",
    ]);
    expect(JSON.stringify(found.body)).not.toContain("Letra de");
    expect(JSON.stringify(found.body)).not.toContain("Obra criada");

    const detail = await publicSong(draft.id);
    expect(detail.status).toBe(200);
    expect(detail.headers.get("cache-control")).toBe("no-store");
    const { song } = (await detail.json()) as { song: Record<string, unknown> };
    expect(song.chordPro).toBe("[G]Letra de Coração de Estrada");
    expect(JSON.stringify(song)).not.toContain("Obra criada");
    expect(song).not.toHaveProperty("status");
  });

  it("busca por título e artista, sem acento, maiúsculas nem espaços extras", async () => {
    await published(input("Manhã de Serra", { artist: "Coletivo Fictício" }));
    await published(input("Ponte de Papel", { artist: "Trio Inventado" }));

    expect((await search("q=%20%20MANHA%20%20")).body.songs.map((song) => song.title)).toEqual(["Manhã de Serra"]);
    expect((await search("q=coletivo")).body.songs.map((song) => song.title)).toEqual(["Manhã de Serra"]);
    expect((await search("q=papel%20trio")).body.songs.map((song) => song.title)).toEqual(["Ponte de Papel"]);
    // Prefixo de palavra: sem busca no meio da palavra.
    expect((await search("q=apel")).body.total).toBe(0);
    // Pontuação separa palavras e nunca vira expressão regular: ".*" equivale à consulta vazia.
    expect((await search("q=.*")).body.total).toBe(2);
    expect((await search("q=man(%5B")).body.songs.map((song) => song.title)).toEqual(["Manhã de Serra"]);
  });

  it("consulta vazia lista em ordem determinística, paginada", async () => {
    for (const title of ["Banana", "Ábaco", "Cacau", "abacate"]) {
      await published(input(title));
    }

    const first = await search("pageSize=3");
    expect(first.body.songs.map((song) => song.title)).toEqual(["abacate", "Ábaco", "Banana"]);
    expect(first.body).toMatchObject({ total: 4, totalPages: 2, page: 1 });
    const second = await search("pageSize=3&page=2");
    expect(second.body.songs.map((song) => song.title)).toEqual(["Cacau"]);
  });

  it("parâmetros inválidos ou acima dos limites são recusados", async () => {
    for (const query of ["page=0", "page=51", "pageSize=25", `q=${"x".repeat(101)}`, "page=abc"]) {
      expect((await search(query)).status).toBe(400);
    }
  });

  it("aplica limite de requisições por cliente", async () => {
    const statuses: number[] = [];
    for (let index = 0; index < 125; index++) {
      const response = await publicSongsRoute.GET(
        new Request(`${ORIGIN}/api/v1/catalog/songs`, { headers: { "x-forwarded-for": "203.0.113.9" } }),
        params({}),
      );
      statuses.push(response.status);
    }
    expect(statuses.filter((status) => status === 429)).toHaveLength(5);
    expect((await search("")).status).toBe(200);
  });

  it("sem direito de exibição, a leitura pública não tem cifra", async () => {
    const song = await published(input("Só Metadados", { contentType: "authorized" }, { basis: "license", displayChordPro: false, shareChordPro: false }));

    const { song: view } = (await (await publicSong(song.id)).json()) as { song: Record<string, unknown> };
    expect(view.chordPro).toBeUndefined();
    expect(view.chordProAvailable).toBe(false);
    expect((await search("q=metadados")).body.songs[0].hasChordPro).toBe(false);
  });

  it("músicas particulares nunca aparecem no catálogo", async () => {
    await createLibraryService(userA.id).songs.create({ ...hostedSong, title: "Particular Secreta" });

    expect((await search("q=secreta")).body.total).toBe(0);
    expect(await CatalogSongModel.countDocuments({})).toBe(0);
  });
});

describe("cenário B: repertório com catálogo", () => {
  it("adiciona só a referência, com tom independente por repertório", async () => {
    const song = await published(input("Estrada"));
    const library = createLibraryService(userA.id);
    const first = await library.repertoires.create({ name: "Show", description: "" });
    const second = await library.repertoires.create({ name: "Ensaio", description: "" });

    const response = await addItem(userA, first, song.id, "catalog");
    expect(response.status).toBe(201);
    const { repertoire } = (await response.json()) as { repertoire: Repertoire };
    expect(repertoire.items[0]).toMatchObject({ songId: song.id, source: "catalog", transposeSemitones: 0 });

    await latest(library).repertoires.addSong(second.id, song.id, "catalog");
    const updated = await latest(library).repertoires.findById(second.id);
    await library.repertoires.updateItem(second.id, updated!.items[0].id, { transposeSemitones: 3 }, updated!.revision);

    const stored = await RepertoireModel.find({ ownerId: userA.id }).lean();
    expect(JSON.stringify(stored)).not.toContain("Letra de Estrada");
    expect(stored.map((doc) => doc.items[0].transposeSemitones).sort()).toEqual([0, 3]);
    expect((await CatalogSongModel.findOne({ id: song.id }).lean())?.originalKey).toBe("G");

    const listed = await listRepertoires(userA);
    expect(listed.catalogSongs.map((entry) => entry.id)).toEqual([song.id]);
    expect(listed.catalogSongs[0].chordPro).toBe("[G]Letra de Estrada");
  });

  it("recusa rascunho, inexistente, duplicada e revisão desatualizada", async () => {
    const draft = await created(input("Rascunho"));
    const song = await published(input("Publicada"));
    const library = createLibraryService(userA.id);
    let repertoire = await library.repertoires.create({ name: "Show", description: "" });

    expect((await addItem(userA, repertoire, draft.id, "catalog")).status).toBe(409);
    expect((await addItem(userA, repertoire, "nao-existe", "catalog")).status).toBe(409);
    expect((await addItem(userA, repertoire, song.id, "invalida")).status).toBe(400);

    const ok = await addItem(userA, repertoire, song.id, "catalog");
    repertoire = ((await ok.json()) as { repertoire: Repertoire }).repertoire;
    expect((await addItem(userA, repertoire, song.id, "catalog")).status).toBe(409);
    expect((await addItem(userA, { ...repertoire, revision: 1 }, song.id, "catalog")).status).toBe(412);
    expect((await RepertoireModel.findOne({ id: repertoire.id }).lean())?.items).toHaveLength(1);
  });

  it("uma conta nunca referencia a música particular de outra", async () => {
    const theirs = await createLibraryService(userB.id).songs.create({ ...hostedSong, title: "De B" });
    const repertoire = await createLibraryService(userA.id).repertoires.create({ name: "Show", description: "" });

    expect((await addItem(userA, repertoire, theirs.id)).status).toBe(404);
    expect((await addItem(userA, repertoire, theirs.id, "personal")).status).toBe(404);
    expect((await addItem(userA, repertoire, theirs.id, "catalog")).status).toBe(409);
  });

  it("um visitante sem sessão não altera repertórios", async () => {
    const song = await published(input("Estrada"));
    const repertoire = await createLibraryService(userA.id).repertoires.create({ name: "Show", description: "" });

    expect((await addItem(null, repertoire, song.id, "catalog")).status).toBe(401);
    expect((await RepertoireModel.findOne({ id: repertoire.id }).lean())?.items).toEqual([]);
  });

  it("músicas particulares continuam funcionando ao lado das do catálogo", async () => {
    const song = await published(input("Do Catálogo"));
    const library = createLibraryService(userA.id);
    const personal = await library.songs.create(hostedSong);
    const repertoire = await library.repertoires.create({ name: "Misto", description: "" });
    await latest(library).repertoires.addSong(repertoire.id, song.id, "catalog");
    await latest(library).repertoires.addSong(repertoire.id, personal.id);

    // A música particular em uso continua protegida; a do catálogo não interfere.
    const remove = await songRoute.DELETE(request(userA, "DELETE", "/x", undefined, personal.revision), params({ id: personal.id }));
    expect(remove.status).toBe(409);
    const listed = await listRepertoires(userA);
    expect(listed.repertoires[0].items.map((item) => item.source)).toEqual(["catalog", "personal"]);
  });
});

describe("cenário C: despublicação", () => {
  it("preserva os repertórios, some do catálogo e bloqueia novas inclusões", async () => {
    const song = await published(input("Vai Sair"));
    const library = createLibraryService(userA.id);
    const repertoire = await library.repertoires.create({ name: "Show", description: "" });
    await latest(library).repertoires.addSong(repertoire.id, song.id, "catalog");
    const other = await library.repertoires.create({ name: "Outro", description: "" });

    const removed = await unpublish(song);
    expect(removed.status).toBe("unpublished");

    expect((await search("q=sair")).body.total).toBe(0);
    expect((await publicSong(song.id)).status).toBe(404);
    const listed = await listRepertoires(userA);
    expect(listed.repertoires.find((r) => r.id === repertoire.id)?.items[0]).toMatchObject({ songId: song.id, source: "catalog" });
    expect(listed.catalogSongs).toEqual([]);
    expect((await addItem(userA, other, song.id, "catalog")).status).toBe(409);

    // Republicar devolve a música aos mesmos repertórios.
    expect((await publish(removed)).status).toBe(200);
    expect((await listRepertoires(userA)).catalogSongs.map((entry) => entry.id)).toEqual([song.id]);
  });
});

describe("cenário D: dados antigos", () => {
  it("itens sem origem continuam particulares e editáveis", async () => {
    const library = createLibraryService(userA.id);
    const personal = await library.songs.create(hostedSong);
    const now = new Date();
    await RepertoireModel.collection.insertOne({
      id: "rep-antigo",
      ownerId: userA.id,
      name: "Antigo",
      description: "",
      revision: 1,
      createdAt: now,
      updatedAt: now,
      items: [{ id: "item-antigo", songId: personal.id, position: 1, transposeSemitones: 2, notes: "Nota" }],
    });

    const listed = await listRepertoires(userA);
    expect(listed.repertoires[0].items[0]).toEqual({ id: "item-antigo", songId: personal.id, source: "personal", position: 1, transposeSemitones: 2, notes: "Nota" });

    const updated = await library.repertoires.updateItem("rep-antigo", "item-antigo", { transposeSemitones: -1 }, 1);
    expect(updated.items[0]).toMatchObject({ source: "personal", transposeSemitones: -1 });
    const song = await published(input("Nova"));
    const mixed = await library.repertoires.addSong("rep-antigo", song.id, updated.revision, "catalog");
    expect(mixed.items.map((item) => item.source)).toEqual(["personal", "catalog"]);

    // A música antiga continua protegida contra exclusão enquanto estiver em uso.
    const remove = await songRoute.DELETE(request(userA, "DELETE", "/x", undefined, personal.revision), params({ id: personal.id }));
    expect(remove.status).toBe(409);
  });
});

describe("cenário E: links públicos", () => {
  async function share(repertoireId: string, selection: ShareSelection = { authorizations: [] }): Promise<ShareSummary> {
    const library = createLibraryService(userA.id);
    const { contentHash } = await library.shares.preview(repertoireId, selection);
    return library.shares.create(repertoireId, { ...selection, expectedHash: contentHash });
  }

  async function openPublic(summary: ShareSummary) {
    const token = summary.path!.replace("/s/", "");
    const response = await publicShareRoute.GET(new Request(`${ORIGIN}/api/v1/public/shares/${token}`), params({ token }));
    expect(response.status).toBe(200);
    return ((await response.json()) as { share: { items: { title: string; content: { kind: string; chordPro?: string } }[] } }).share;
  }

  it("aplica os direitos da plataforma e reavalia na leitura pública", async () => {
    const free = await published(input("Livre"));
    const displayOnly = await published(input("Só Exibe", {}, { basis: "license", shareChordPro: false }));
    const external = await published(input("Fora", { contentType: "external-link", sourceUrl: "https://example.com/fora", chordPro: undefined }));
    const library = createLibraryService(userA.id);
    const personal = await library.songs.create({ ...hostedSong, title: "Minha" });
    const repertoire = await library.repertoires.create({ name: "Show", description: "" });
    for (const [songId, source] of [[free.id, "catalog"], [personal.id, "personal"], [displayOnly.id, "catalog"], [external.id, "catalog"]] as const) {
      await latest(library).repertoires.addSong(repertoire.id, songId, source);
    }

    const summary = await share(repertoire.id);
    let body = await openPublic(summary);
    expect(body.items.map((item) => item.content.kind)).toEqual(["chordpro", "none", "none", "external-link"]);
    expect(JSON.stringify(body)).not.toContain("Obra criada");

    // A plataforma revoga o direito de redistribuição: o link antigo deixa de mostrar a cifra.
    const current = await CatalogSongModel.findOne({ id: free.id }).lean();
    const revoked = await adminSongRoute.PUT(
      request(admin, "PUT", "/x", input("Livre", {}, { basis: "license", shareChordPro: false }), current!.revision),
      params({ id: free.id }),
    );
    expect(revoked.status).toBe(200);
    body = await openPublic(summary);
    expect(body.items[0].content.kind).toBe("unavailable");
    expect(JSON.stringify(body)).not.toContain("Letra de Livre");

    // Despublicada: o link mostra só que a música não está disponível.
    await unpublish(((await revoked.json()) as { song: CatalogSong }).song);
    body = await openPublic(summary);
    expect(body.items[0]).toMatchObject({ title: "Livre", content: { kind: "unavailable" } });
    expect(body.items[1].title).toBe("Minha");
  });
});

describe("cenário F: backup", () => {
  it("exporta referências do catálogo na versão 2 e restaura em outra conta", async () => {
    const song = await published(input("No Backup"));
    const library = createLibraryService(userA.id);
    const repertoire = await library.repertoires.create({ name: "Show", description: "" });
    await latest(library).repertoires.addSong(repertoire.id, song.id, "catalog");

    const { backup } = (await (await exportRoute.GET(request(userA, "GET", "/x"), params({}))).json()) as { backup: { schemaVersion: number; songs: unknown[]; repertoires: { items: { source: string }[] }[] } };
    expect(backup.schemaVersion).toBe(2);
    expect(backup.songs).toEqual([]);
    expect(backup.repertoires[0].items[0].source).toBe("catalog");
    expect(JSON.stringify(backup)).not.toContain("Letra de No Backup");

    const restored = await createLibraryService(userB.id).imports.execute({ importId: crypto.randomUUID(), backup } as never);
    expect(restored.summary).toMatchObject({ repertoires: 1 });
    expect((await listRepertoires(userB)).catalogSongs.map((entry) => entry.id)).toEqual([song.id]);
  });

  it("sem catálogo, continua exportando a versão 1", async () => {
    const library = createLibraryService(userA.id);
    const personal = await library.songs.create(hostedSong);
    const repertoire = await library.repertoires.create({ name: "Show", description: "" });
    await latest(library).repertoires.addSong(repertoire.id, personal.id);

    const { backup } = (await (await exportRoute.GET(request(userA, "GET", "/x"), params({}))).json()) as { backup: { schemaVersion: number } };
    expect(backup.schemaVersion).toBe(1);
    expect(JSON.stringify(backup)).not.toContain('"source"');
  });

  it("recusa restaurar referências a músicas que saíram do catálogo", async () => {
    const song = await published(input("Sairá"));
    const library = createLibraryService(userA.id);
    const repertoire = await library.repertoires.create({ name: "Show", description: "" });
    await latest(library).repertoires.addSong(repertoire.id, song.id, "catalog");
    const backup = await library.exportBackup();
    await unpublish((await CatalogSongModel.findOne({ id: song.id }).lean()) as unknown as CatalogSong);

    await expect(
      createLibraryService(userB.id).imports.execute({ importId: crypto.randomUUID(), backup } as never),
    ).rejects.toMatchObject({ code: "invalid-data" });
    expect(await RepertoireModel.countDocuments({ ownerId: userB.id })).toBe(0);
  });
});

describe("cenário G: administração", () => {
  it("conta comum e visitante não acessam a administração", async () => {
    const body = input("Tentativa");
    expect((await adminCreate(body, userA)).status).toBe(403);
    const anonymous = await adminSongsRoute.POST(
      new Request(`${ORIGIN}/x`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: JSON.stringify(body) }),
      params({}),
    );
    expect(anonymous.status).toBe(401);
    expect((await adminSongsRoute.GET(request(userA, "GET", "/x"), params({}))).status).toBe(403);
    expect(await CatalogSongModel.countDocuments({})).toBe(0);
  });

  it("o papel não vem do cliente nem do cadastro", async () => {
    const email = `promove-${crypto.randomUUID()}@exemplo.test`;
    const response = await authRequest("sign-up/email", { name: "X", email, password: "senha-de-teste-123", role: "admin" });
    expect([200, 400, 422]).toContain(response.status);
    expect(await CatalogAdminModel.countDocuments({})).toBe(1);

    const withRole = { ...input("Com papel"), role: "admin" };
    expect((await adminCreate(withRole as never, userA)).status).toBe(403);
    expect(await adminCli("list")).toContain(admin.email);
  });

  it("revogar pelo comando tira o acesso na requisição seguinte", async () => {
    expect((await adminSongsRoute.GET(request(admin, "GET", "/x"), params({}))).status).toBe(200);
    expect(await adminCli("revoke", "--email", admin.email)).toContain("Papel revogado.");
    expect((await adminSongsRoute.GET(request(admin, "GET", "/x"), params({}))).status).toBe(403);
  });

  it("o comando só concede a contas existentes", async () => {
    await expect(adminCli("grant", "--email", "ninguem@exemplo.test")).rejects.toMatchObject({ code: 1 });
    expect(await CatalogAdminModel.countDocuments({})).toBe(1);
  });

  it("lista rascunhos, exige revisão e recusa versões desatualizadas", async () => {
    const draft = await created(input("Rascunho"));
    const drafts = (await (await adminSongsRoute.GET(request(admin, "GET", "/x?status=draft"), params({}))).json()) as { songs: CatalogSong[] };
    expect(drafts.songs.map((song) => song.id)).toEqual([draft.id]);

    const missing = await adminSongRoute.PUT(request(admin, "PUT", "/x", input("Sem revisão")), params({ id: draft.id }));
    expect(missing.status).toBe(428);
    const saved = await adminSongRoute.PUT(request(admin, "PUT", "/x", input("Primeira edição"), 1), params({ id: draft.id }));
    expect(saved.status).toBe(200);
    const stale = await adminSongRoute.PUT(request(admin, "PUT", "/x", input("Edição concorrente"), 1), params({ id: draft.id }));
    expect(stale.status).toBe(412);
    expect((await CatalogSongModel.findOne({ id: draft.id }).lean())?.title).toBe("Primeira edição");
  });

  it("não muda o tom de uma música já publicada nem a apaga", async () => {
    const song = await published(input("Publicada"));
    const changed = await adminSongRoute.PUT(
      request(admin, "PUT", "/x", input("Publicada", { originalKey: "A" }), song.revision),
      params({ id: song.id }),
    );
    expect(changed.status).toBe(400);
    expect(JSON.stringify(await changed.json())).toContain("tom original de uma música já publicada");
    expect("DELETE" in adminSongRoute).toBe(false);

    const removed = await unpublish(song);
    const afterUnpublish = await adminSongRoute.PUT(
      request(admin, "PUT", "/x", input("Publicada", { originalKey: "A" }), removed.revision),
      params({ id: song.id }),
    );
    expect(afterUnpublish.status).toBe(400);
    expect((await CatalogSongModel.findOne({ id: song.id }).lean())?.originalKey).toBe("G");
  });

  it("registra quem aprovou os direitos e quando", async () => {
    const song = await created(input("Aprovada"));
    expect(song.rights.approvedBy).toBe(admin.id);
    expect(Date.parse(song.rights.approvedAt)).not.toBeNaN();
  });
});
