import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as importPreviewRoute from "@/app/api/v1/admin/catalog/import/preview/route";
import * as importRoute from "@/app/api/v1/admin/catalog/import/route";
import * as classificationReviewRoute from "@/app/api/v1/admin/catalog/songs/[id]/classification/review/route";
import * as classificationRoute from "@/app/api/v1/admin/catalog/songs/[id]/classification/route";
import * as adminPublishRoute from "@/app/api/v1/admin/catalog/songs/[id]/publish/route";
import * as adminSongRoute from "@/app/api/v1/admin/catalog/songs/[id]/route";
import * as adminSongsRoute from "@/app/api/v1/admin/catalog/songs/route";
import * as diagnosticsRoute from "@/app/api/v1/admin/liturgy/celebrations/[id]/diagnostics/route";
import * as publicSongRoute from "@/app/api/v1/catalog/songs/[id]/route";
import * as publicSongsRoute from "@/app/api/v1/catalog/songs/route";
import * as itemRoute from "@/app/api/v1/library/repertoires/[id]/items/[itemId]/route";
import * as suggestionsRoute from "@/app/api/v1/liturgy/suggestions/route";
import * as publicShareRoute from "@/app/api/v1/public/shares/[token]/route";
import initialCatalog from "@/features/catalog/data/catalogo-editorial-inicial.json";
import type { CatalogSong, CatalogSongInput } from "@/features/catalog/domain/catalog-song";
import type { SongClassificationInput } from "@/features/liturgy/domain/classification";
import type { CatalogCoverage, MomentSuggestions } from "@/features/liturgy/domain/recommendation";
import { getCatalogExploreFacets } from "@/server/catalog/catalog-service";
import { CatalogSongModel } from "@/server/database/models/catalog-song-model";
import { LiturgicalCelebrationModel } from "@/server/database/models/liturgical-celebration-model";
import { resetRateLimitsForTests } from "@/server/http/rate-limit";
import { createLibraryService } from "@/server/library/library-service";

import { clearDatabase, createTestUser, dropTestDatabase, importEditorialCelebrations, ORIGIN, type TestUser } from "./helpers";

const run = promisify(execFile);
const SECRET = "chave-de-integracao-com-mais-de-32-caracteres";

let admin: TestUser;
let musician: TestUser;

function request(user: TestUser | null, method: string, body?: unknown, revision?: number): Request {
  return new Request(`${ORIGIN}/api/v1/x`, {
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

const METADATA_RIGHTS = { basis: "public-metadata", evidence: "Título e autoria publicados na fonte citada.", displayChordPro: false, shareChordPro: false } as const;

function metadataInput(title: string, fields: Partial<CatalogSongInput> = {}): CatalogSongInput {
  return {
    song: { title, artist: "", contentType: "metadata-only" },
    rights: METADATA_RIGHTS,
    metadataSources: [{ title: "[TESTE] Fonte fictícia", url: "https://example.com/fonte" }],
    ...fields,
  };
}

async function create(body: CatalogSongInput): Promise<CatalogSong> {
  const response = await adminSongsRoute.POST(request(admin, "POST", body), params({}));
  expect(response.status).toBe(201);
  return (await json<{ song: CatalogSong }>(response)).song;
}

async function publish(song: CatalogSong): Promise<Response> {
  return adminPublishRoute.POST(request(admin, "POST", undefined, song.revision), params({ id: song.id }));
}

async function published(body: CatalogSongInput): Promise<CatalogSong> {
  const response = await publish(await create(body));
  expect(response.status).toBe(200);
  return (await json<{ song: CatalogSong }>(response)).song;
}

function liturgy(fields: Partial<SongClassificationInput> = {}): SongClassificationInput {
  return {
    category: "liturgical",
    moments: ["comunhao"],
    seasons: [],
    celebrations: [],
    themes: [],
    scripture: [],
    avoidSeasons: [],
    suitabilityNotes: "",
    editorialRationale: "[TESTE] Justificativa",
    officialReference: "",
    guidanceSource: "[TESTE] Subsídio fictício",
    ...fields,
  };
}

async function classify(song: CatalogSong, fields: Partial<SongClassificationInput> = {}): Promise<CatalogSong> {
  const response = await classificationRoute.PUT(request(admin, "PUT", { liturgy: liturgy(fields) }, song.revision), params({ id: song.id }));
  expect(response.status).toBe(200);
  return (await json<{ song: CatalogSong }>(response)).song;
}

/** `revision: null` envia o pedido sem If-Match. */
function review(song: CatalogSong, body: unknown, user: TestUser | null = admin, revision: number | null = song.revision): Promise<Response> {
  return classificationReviewRoute.POST(request(user, "POST", body, revision ?? undefined), params({ id: song.id }));
}

const APPROVE = { action: "approve", humanReviewConfirmed: true, source: "[TESTE] Hinário conferido" };

async function search(query: string) {
  const response = await publicSongsRoute.GET(new Request(`${ORIGIN}/api/v1/catalog/songs?${query}`), params({}));
  return { status: response.status, body: await json<{ songs: Record<string, unknown>[]; total: number }>(response) };
}

async function publicView(id: string): Promise<Record<string, unknown>> {
  const response = await publicSongRoute.GET(new Request(`${ORIGIN}/api/v1/catalog/songs/${id}`), params({ id }));
  expect(response.status).toBe(200);
  return (await json<{ song: Record<string, unknown> }>(response)).song;
}

async function suggestions(query: string) {
  const response = await suggestionsRoute.GET(new Request(`${ORIGIN}/api/v1/liturgy/suggestions?${query}`), params({}));
  return json<{ moments: (MomentSuggestions & { classifiedForMoment?: number })[]; catalog?: CatalogCoverage; assurance: string }>(response);
}

const DOCUMENT = {
  format: "repertorio-web/catalogo-editorial",
  version: 1,
  records: [
    {
      importKey: "teste-canto-um",
      title: "[TESTE] Canto Um",
      artist: "Autoria Fictícia",
      contentType: "metadata-only",
      metadataSources: [{ title: "[TESTE] Fonte", url: "https://example.com/um" }],
      classification: { moments: ["comunhao"], guidanceSource: "[TESTE] Subsídio" },
    },
    {
      importKey: "teste-canto-dois",
      title: "[TESTE] Canto Dois",
      artist: "",
      contentType: "metadata-only",
      metadataSources: [{ title: "[TESTE] Fonte" }],
    },
  ],
};

function preview(document: unknown, user: TestUser | null = admin): Promise<Response> {
  return importPreviewRoute.POST(request(user, "POST", { document }), params({}));
}

function commit(document: unknown, user: TestUser | null = admin, confirm: unknown = true): Promise<Response> {
  return importRoute.POST(request(user, "POST", { document, confirm }), params({}));
}

beforeEach(async () => {
  resetRateLimitsForTests();
  vi.stubEnv("PUBLIC_SHARING_ENABLED", "true");
  vi.stubEnv("SHARE_LINK_SECRET", SECRET);
  await clearDatabase();
  admin = await createTestUser("admin");
  musician = await createTestUser("musico");
  await run(process.execPath, ["scripts/catalog-admin.mjs", "grant", "--email", admin.email], { env: process.env });
  await importEditorialCelebrations();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(dropTestDatabase);

describe("música sem cifra", () => {
  it("rascunho parcial: só título e fonte, sem tom, sem autoria e sem evidência", async () => {
    const draft = await create({
      song: { title: "[TESTE] Rascunho", artist: "", contentType: "metadata-only" },
      rights: { basis: "public-metadata", evidence: "", displayChordPro: false, shareChordPro: false },
    });
    expect(draft).toMatchObject({ status: "draft", contentType: "metadata-only", artist: "" });
    expect(draft).not.toHaveProperty("originalKey");
    expect(draft).not.toHaveProperty("chordPro");

    // Publicar exige a evidência dos direitos.
    expect((await publish(draft)).status).toBe(400);
    const updated = await adminSongRoute.PUT(request(admin, "PUT", metadataInput("[TESTE] Rascunho"), draft.revision), params({ id: draft.id }));
    expect(updated.status).toBe(200);
    expect((await publish((await json<{ song: CatalogSong }>(updated)).song)).status).toBe(200);
  });

  it("recusa cifra em música só com metadados e força as permissões de conteúdo", async () => {
    const withChords = await adminSongsRoute.POST(
      request(admin, "POST", { ...metadataInput("[TESTE] X"), song: { title: "X", artist: "", contentType: "metadata-only", chordPro: "[G]x" } }),
      params({}),
    );
    expect(withChords.status).toBe(400);

    const song = await create(metadataInput("[TESTE] Sem permissões", { rights: { ...METADATA_RIGHTS, displayChordPro: true, shareChordPro: true } }));
    expect(song.rights).toMatchObject({ displayChordPro: false, shareChordPro: false });
  });

  it("o público vê só metadados e fontes, com o indicador certo na busca", async () => {
    const song = await published(
      metadataInput("[TESTE] Só Metadados", { compositionReference: "[TESTE] Hinário, n. 1" }),
    );

    const view = await publicView(song.id);
    expect(view).toMatchObject({
      contentType: "metadata-only",
      chordProAvailable: false,
      compositionReference: "[TESTE] Hinário, n. 1",
      metadataSources: [{ title: "[TESTE] Fonte fictícia", url: "https://example.com/fonte" }],
    });
    expect(view).not.toHaveProperty("originalKey");
    expect(JSON.stringify(view)).not.toContain("Título e autoria publicados");

    const found = await search("q=metadados");
    expect(found.body.songs[0]).toMatchObject({ contentType: "metadata-only", hasChordPro: false });
    expect(found.body.songs[0]).not.toHaveProperty("originalKey");
  });

  it("link externo sem permissão de mostrar o link não vaza o endereço", async () => {
    const song = await published({
      song: { title: "[TESTE] Link Restrito", artist: "Grupo Fictício", originalKey: "D", contentType: "external-link", sourceUrl: "https://example.com/segredo" },
      rights: { basis: "external-reference", evidence: "[TESTE]", displayChordPro: false, shareChordPro: false, linkExternalSource: false },
    });

    expect(JSON.stringify(await publicView(song.id))).not.toContain("example.com/segredo");
    expect((await publicView(song.id)).contentType).toBe("metadata-only");
    const found = await search("q=restrito");
    expect(found.body.songs[0]?.contentType).toBe("metadata-only");
    expect(JSON.stringify(found.body)).not.toContain("segredo");
  });

  it("entra no repertório com momento, sem transposição, e o link público não traz cifra", async () => {
    const song = await published(metadataInput("[TESTE] Para o Repertório"));
    const library = createLibraryService(musician.id);
    const repertoire = await library.repertoires.create({ name: "Missa de teste", description: "" });
    const withSong = await library.repertoires.addSong(repertoire.id, song.id, repertoire.revision, "catalog", "comunhao");
    const item = withSong.items[0];
    expect(item).toMatchObject({ source: "catalog", moment: "comunhao", transposeSemitones: 0 });

    const transposed = await itemRoute.PATCH(
      request(musician, "PATCH", { transposeSemitones: 2 }, withSong.revision),
      params({ id: repertoire.id, itemId: item.id }),
    );
    expect(transposed.status).toBe(400);

    const selection = { authorizations: [], includeMassDate: false };
    const { contentHash } = await library.shares.preview(repertoire.id, selection);
    const summary = await library.shares.create(repertoire.id, { ...selection, expectedHash: contentHash });
    const token = summary.path!.replace("/s/", "");
    const response = await publicShareRoute.GET(new Request(`${ORIGIN}/api/v1/public/shares/${token}`), params({ token }));
    const { share } = await json<{ share: { items: { title: string; content: { kind: string } }[] } }>(response);
    expect(share.items[0]).toMatchObject({ title: "[TESTE] Para o Repertório", content: { kind: "none" } });
  });
});

describe("classificação e revisão editorial", () => {
  it("salva incompleta, mas só confere completa, com fonte e confirmação pessoal", async () => {
    const song = await published(metadataInput("[TESTE] Revisão"));
    const incomplete = await classify(song, { guidanceSource: "" });
    expect(incomplete.liturgy).toMatchObject({ reviewStatus: "pending_review", review: null });

    expect((await review(incomplete, APPROVE)).status).toBe(400);
    const complete = await classify(incomplete);
    expect((await review(complete, { ...APPROVE, humanReviewConfirmed: false })).status).toBe(400);
    expect((await review(complete, APPROVE, null)).status).toBe(401);
    expect((await review(complete, APPROVE, musician)).status).toBe(403);
    expect((await review(complete, APPROVE, admin, null)).status).toBe(428);
    expect((await review(complete, APPROVE, admin, complete.revision - 1)).status).toBe(412);

    const approved = await review(complete, APPROVE);
    expect(approved.status).toBe(200);
    const reviewed = (await json<{ song: CatalogSong }>(approved)).song;
    expect(reviewed.liturgy).toMatchObject({ reviewStatus: "reviewed", review: { by: admin.id, source: "[TESTE] Hinário conferido" } });

    // O público vê a data e a fonte da conferência, nunca quem conferiu.
    const view = JSON.stringify(await publicView(song.id));
    expect(view).toContain("[TESTE] Hinário conferido");
    expect(view).not.toContain(admin.id);

    // Reclassificar volta para "não conferida".
    const changed = await classify(reviewed, { moments: ["comunhao", "acao-de-gracas"] });
    expect(changed.liturgy?.reviewStatus).toBe("pending_review");
  });

  it("divergência tira a música das sugestões até ser resolvida", async () => {
    const song = await classify(await published(metadataInput("[TESTE] Divergente")));
    const titles = async () =>
      (await suggestions("date=2026-11-22&moment=comunhao")).moments[0]?.suggestions.map((entry) => entry.song.title) ?? [];
    expect(await titles()).toContain("[TESTE] Divergente");

    const disputed = (await json<{ song: CatalogSong }>(await review(song, { action: "dispute", note: "[TESTE] Momento discutível" }))).song;
    expect(disputed.liturgy?.reviewStatus).toBe("disputed");
    expect(await titles()).not.toContain("[TESTE] Divergente");
    expect((await review(disputed, APPROVE)).status).toBe(400);

    const resolved = await review(disputed, { action: "resolve", note: "[TESTE] Conferido" });
    expect((await json<{ song: CatalogSong }>(resolved)).song.liturgy?.reviewStatus).toBe("pending_review");
    expect(await titles()).toContain("[TESTE] Divergente");
  });

  it("classificação não dá direitos: classificar não altera permissões nem publicação", async () => {
    const draft = await create(metadataInput("[TESTE] Sem Direitos"));
    const classified = await classify(draft);
    expect(classified).toMatchObject({ status: "draft", rights: { displayChordPro: false, shareChordPro: false } });
  });
});

describe("exploração e sugestões", () => {
  it("filtra por momento, tempo e celebração, combinados, só com o que está publicado", async () => {
    await classify(await published(metadataInput("[TESTE] Comunhão Quaresma")), { seasons: ["quaresma"] });
    await classify(await published(metadataInput("[TESTE] Comunhão Livre")));
    await classify(await published(metadataInput("[TESTE] Entrada Cristo Rei")), { moments: ["entrada"], celebrations: ["cristo-rei"] });
    await classify(await create(metadataInput("[TESTE] Rascunho Classificado")), { moments: ["comunhao"] });

    const byMoment = await search("moment=comunhao");
    expect(byMoment.body.songs.map((song) => song.title).sort()).toEqual(["[TESTE] Comunhão Livre", "[TESTE] Comunhão Quaresma"]);
    expect((await search("moment=comunhao&season=quaresma")).body.songs.map((song) => song.title)).toEqual(["[TESTE] Comunhão Quaresma"]);
    expect((await search("celebration=cristo-rei&moment=entrada")).body.total).toBe(1);
    expect((await search("celebration=cristo-rei&moment=comunhao")).body.total).toBe(0);

    const facets = await getCatalogExploreFacets();
    expect(facets.moments).toEqual(expect.arrayContaining([{ id: "comunhao", count: 2 }, { id: "entrada", count: 1 }]));
    expect(facets.seasons).toEqual([{ id: "quaresma", count: 1 }]);
    expect(facets.celebrations).toEqual([{ id: "cristo-rei", count: 1 }]);
    expect(facets.themes).toEqual([]);
  });

  it("sugestões informam a cobertura do catálogo e a conferência de cada música", async () => {
    const empty = await suggestions("date=2026-11-22");
    expect(empty.catalog).toEqual({ published: 0, classified: 0, classifiedForMass: 0 });

    const reviewedSong = await classify(await published(metadataInput("[TESTE] Conferida")));
    expect((await review(reviewedSong, APPROVE)).status).toBe(200);
    await classify(await published(metadataInput("[TESTE] Não Conferida")));
    await classify(await published(metadataInput("[TESTE] Só Quaresma")), { seasons: ["quaresma"] });
    await published(metadataInput("[TESTE] Sem Classificação"));

    const result = await suggestions("date=2026-11-22");
    expect(result.catalog).toEqual({ published: 4, classified: 3, classifiedForMass: 3 });
    const communion = result.moments.find((entry) => entry.moment === "comunhao")!;
    expect(communion.classifiedForMoment).toBe(3);
    expect(communion.total).toBe(2);
    expect(Object.fromEntries(communion.suggestions.map((entry) => [entry.song.title, entry.classification]))).toEqual({
      "[TESTE] Conferida": "reviewed",
      "[TESTE] Não Conferida": "pending_review",
    });
    expect(result.moments.find((entry) => entry.moment === "entrada")?.classifiedForMoment).toBe(0);
  });

  it("o diagnóstico da celebração é só da administração e usa as mesmas regras", async () => {
    await classify(await published(metadataInput("[TESTE] A")));
    await classify(await published(metadataInput("[TESTE] B")), { seasons: ["quaresma"] });

    const id = "2026-11-22-cristo-rei";
    expect((await diagnosticsRoute.GET(request(musician, "GET"), params({ id }))).status).toBe(403);
    expect((await diagnosticsRoute.GET(request(null, "GET"), params({ id }))).status).toBe(401);
    const response = await diagnosticsRoute.GET(request(admin, "GET"), params({ id }));
    expect(response.status).toBe(200);
    const { moments } = await json<{ moments: { moment: string; classified: number; eligible: number; discarded: Record<string, number> }[] }>(response);
    expect(moments.find((entry) => entry.moment === "comunhao")).toMatchObject({
      classified: 2,
      eligible: 1,
      discarded: { "other-season-or-celebration": 1 },
    });
  });

  it("as celebrações editoriais continuam sem aprovação automática", async () => {
    expect(await LiturgicalCelebrationModel.countDocuments({ reviewStatus: "reviewed" })).toBe(0);
  });
});

describe("importação de metadados", () => {
  it("anônimos e músicos não importam nem veem a prévia", async () => {
    expect((await preview(DOCUMENT, null)).status).toBe(401);
    expect((await preview(DOCUMENT, musician)).status).toBe(403);
    expect((await commit(DOCUMENT, null)).status).toBe(401);
    expect((await commit(DOCUMENT, musician)).status).toBe(403);
    expect(await CatalogSongModel.countDocuments()).toBe(0);
  });

  it("a prévia não grava; a importação exige confirmação e cria só rascunhos", async () => {
    const previewed = await preview(DOCUMENT);
    expect(previewed.status).toBe(200);
    expect((await json<{ preview: { counts: Record<string, number> } }>(previewed)).preview.counts).toEqual({
      new: 2,
      existing: 0,
      duplicate: 0,
      invalid: 0,
    });
    expect(await CatalogSongModel.countDocuments()).toBe(0);

    expect((await commit(DOCUMENT, admin, false)).status).toBe(400);
    expect(await CatalogSongModel.countDocuments()).toBe(0);

    const response = await commit(DOCUMENT);
    expect(response.status).toBe(201);
    const { result } = await json<{ result: { created: { id: string }[] } }>(response);
    expect(result.created).toHaveLength(2);

    const stored = await CatalogSongModel.find({}).lean();
    for (const song of stored) {
      expect(song.status).toBe("draft");
      expect(song.contentType).toBe("metadata-only");
      expect(song.rights).toMatchObject({ displayChordPro: false, shareChordPro: false, approvedBy: admin.id });
      expect(song).not.toHaveProperty("chordPro");
    }
    const one = stored.find((song) => song.importKey === "teste-canto-um");
    expect(one?.liturgy).toMatchObject({
      moments: ["comunhao"],
      classifiedBy: "importacao-editorial",
      reviewStatus: "pending_review",
      editorialRationale: "",
    });
    // Nada importado aparece ao público antes da revisão e da publicação.
    expect((await search("q=canto")).body.total).toBe(0);
  });

  it("é idempotente e não altera músicas existentes", async () => {
    await commit(DOCUMENT);
    const before = await CatalogSongModel.findOne({ importKey: "teste-canto-um" }).lean();
    await CatalogSongModel.updateOne({ importKey: "teste-canto-um" }, { $set: { title: "[TESTE] Editado pela equipe" } });

    const again = await commit(DOCUMENT);
    expect(again.status).toBe(201);
    const { result } = await json<{ result: { created: unknown[]; counts: Record<string, number> } }>(again);
    expect(result.created).toEqual([]);
    expect(result.counts.existing).toBe(2);
    expect(await CatalogSongModel.countDocuments()).toBe(2);
    const after = await CatalogSongModel.findOne({ importKey: "teste-canto-um" }).lean();
    expect(after?.title).toBe("[TESTE] Editado pela equipe");
    expect(after?.revision).toBe(before?.revision);
  });

  it("aponta duplicata de música cadastrada à mão e não a cria", async () => {
    await create(metadataInput("[TESTE] Canto Dois"));
    const response = await commit(DOCUMENT);
    const { result } = await json<{ result: { created: unknown[]; counts: Record<string, number> } }>(response);
    expect(result.counts).toMatchObject({ new: 1, duplicate: 1 });
    expect(await CatalogSongModel.countDocuments({ title: "[TESTE] Canto Dois" })).toBe(1);
  });

  it("recusa arquivo inválido sem gravar nada", async () => {
    expect((await preview({ format: "outro", version: 1, records: [] })).status).toBe(400);
    expect((await commit({ ...DOCUMENT, records: [{ ...DOCUMENT.records[0], chordPro: "[G]x" }] })).status).toBe(201);
    expect(await CatalogSongModel.countDocuments()).toBe(0);
  });

  it("o catálogo editorial inicial do projeto importa como rascunhos, sem classificação conferida", async () => {
    const response = await commit(initialCatalog);
    expect(response.status).toBe(201);
    const { result } = await json<{ result: { created: unknown[]; counts: Record<string, number> } }>(response);
    expect(result.counts).toMatchObject({ invalid: 0, duplicate: 0 });
    expect(result.created).toHaveLength(initialCatalog.records.length);
    expect(await CatalogSongModel.countDocuments({ status: { $ne: "draft" } })).toBe(0);
    expect(await CatalogSongModel.countDocuments({ "liturgy.reviewStatus": "reviewed" })).toBe(0);
    expect(await CatalogSongModel.countDocuments({ chordPro: { $exists: true } })).toBe(0);
  });
});
