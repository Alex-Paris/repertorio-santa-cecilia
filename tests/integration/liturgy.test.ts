import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as classificationRoute from "@/app/api/v1/admin/catalog/songs/[id]/classification/route";
import * as adminPublishRoute from "@/app/api/v1/admin/catalog/songs/[id]/publish/route";
import * as adminUnpublishRoute from "@/app/api/v1/admin/catalog/songs/[id]/unpublish/route";
import * as adminSongsRoute from "@/app/api/v1/admin/catalog/songs/route";
import * as publicSongRoute from "@/app/api/v1/catalog/songs/[id]/route";
import * as publicSongsRoute from "@/app/api/v1/catalog/songs/route";
import * as exportRoute from "@/app/api/v1/library/export/route";
import * as itemRoute from "@/app/api/v1/library/repertoires/[id]/items/[itemId]/route";
import * as itemsRoute from "@/app/api/v1/library/repertoires/[id]/items/route";
import * as repertoireRoute from "@/app/api/v1/library/repertoires/[id]/route";
import * as repertoiresRoute from "@/app/api/v1/library/repertoires/route";
import * as celebrationsRoute from "@/app/api/v1/liturgy/celebrations/route";
import * as suggestionsRoute from "@/app/api/v1/liturgy/suggestions/route";
import * as publicShareRoute from "@/app/api/v1/public/shares/[token]/route";
import type { CatalogSong, CatalogSongInput } from "@/features/catalog/domain/catalog-song";
import type { SongClassificationInput } from "@/features/liturgy/domain/classification";
import type { MomentSuggestions } from "@/features/liturgy/domain/recommendation";
import type { Repertoire } from "@/features/repertoires/domain/repertoire";
import type { PublicShareSnapshot, ShareSelection } from "@/features/sharing/domain/public-share";
import { CatalogSongModel } from "@/server/database/models/catalog-song-model";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { RepertoireShareModel } from "@/server/database/models/repertoire-share-model";
import { resetRateLimitsForTests } from "@/server/http/rate-limit";
import { createLibraryService } from "@/server/library/library-service";

import {
  clearDatabase,
  createTestUser,
  dropTestDatabase,
  hostedSong,
  importEditorialCelebrations,
  ORIGIN,
  type TestUser,
} from "./helpers";

const run = promisify(execFile);
const SECRET = "chave-de-integracao-com-mais-de-32-caracteres";

let admin: TestUser;
let userA: TestUser;
let userB: TestUser;

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

function songInput(title: string, rights: Partial<CatalogSongInput["rights"]> = {}): CatalogSongInput {
  return {
    song: { title, artist: "Grupo Fictício", originalKey: "C", contentType: "original", chordPro: `[C]Letra de ${title}` },
    rights: { basis: "original-work", evidence: "EVIDENCIA INTERNA", displayChordPro: true, shareChordPro: true, ...rights },
  };
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
    editorialRationale: "JUSTIFICATIVA INTERNA",
    guidanceSource: "Fonte fictícia de teste",
    officialReference: "",
    ...fields,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function createSong(title: string, rights?: Partial<CatalogSongInput["rights"]>): Promise<CatalogSong> {
  const response = await adminSongsRoute.POST(request(admin, "POST", songInput(title, rights)), params({}));
  expect(response.status).toBe(201);
  return (await json<{ song: CatalogSong }>(response)).song;
}

async function publish(song: CatalogSong): Promise<CatalogSong> {
  const response = await adminPublishRoute.POST(request(admin, "POST", undefined, song.revision), params({ id: song.id }));
  expect(response.status).toBe(200);
  return (await json<{ song: CatalogSong }>(response)).song;
}

function classify(song: Pick<CatalogSong, "id">, body: unknown, revision?: number, user: TestUser | null = admin): Promise<Response> {
  return classificationRoute.PUT(request(user, "PUT", body, revision), params({ id: song.id }));
}

/** Música publicada e classificada, como a administração faria pela tela. */
async function classified(title: string, fields: Partial<SongClassificationInput> = {}, rights?: Partial<CatalogSongInput["rights"]>): Promise<CatalogSong> {
  const published = await publish(await createSong(title, rights));
  const response = await classify(published, { liturgy: liturgy(fields) }, published.revision);
  expect(response.status).toBe(200);
  return (await json<{ song: CatalogSong }>(response)).song;
}

async function search(query: string) {
  const response = await publicSongsRoute.GET(new Request(`${ORIGIN}/api/v1/catalog/songs?${query}`), params({}));
  return { status: response.status, body: await json<{ songs: { title: string; moments?: string[] }[]; total: number; totalPages: number }>(response) };
}

async function suggestions(query: string) {
  const response = await suggestionsRoute.GET(new Request(`${ORIGIN}/api/v1/liturgy/suggestions?${query}`), params({}));
  return { status: response.status, body: await json<{ moments: MomentSuggestions[]; error?: { code: string } }>(response) };
}

const titlesFor = (moments: MomentSuggestions[], moment: string) =>
  moments.find((entry) => entry.moment === moment)?.suggestions.map((entry) => entry.song.title) ?? [];

beforeEach(async () => {
  resetRateLimitsForTests();
  vi.stubEnv("PUBLIC_SHARING_ENABLED", "true");
  vi.stubEnv("SHARE_LINK_SECRET", SECRET);
  await clearDatabase();
  admin = await createTestUser("admin");
  userA = await createTestUser("usuaria-a");
  userB = await createTestUser("usuario-b");
  await run(process.execPath, ["scripts/catalog-admin.mjs", "grant", "--email", admin.email], { env: process.env });
  // Desde a Etapa 2E.3 o calendário vem do MongoDB: a base editorial é importada explicitamente.
  await importEditorialCelebrations();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(dropTestDatabase);

describe("classificação pela administração", () => {
  it("grava vários momentos e temas sem tocar em direitos, status ou cifra", async () => {
    const song = await publish(await createSong("Mesa do Caminho", { shareChordPro: false }));
    const before = await CatalogSongModel.findOne({ id: song.id }).lean();

    const response = await classify(
      song,
      {
        liturgy: liturgy({
          moments: ["comunhao", "acao-de-gracas"],
          themes: ["eucaristia", "misericordia"],
          seasons: ["quaresma"],
          celebrations: ["sagrado-coracao"],
          scripture: [{ book: "jo", chapter: 6, verseStart: 51, verseEnd: 58 }],
        }),
      },
      song.revision,
    );

    expect(response.status).toBe(200);
    const { song: saved } = await json<{ song: CatalogSong }>(response);
    expect(saved.revision).toBe(song.revision + 1);
    expect(saved.liturgy).toMatchObject({
      moments: ["comunhao", "acao-de-gracas"],
      themes: ["eucaristia", "misericordia"],
      classifiedBy: admin.id,
    });

    const after = await CatalogSongModel.findOne({ id: song.id }).lean();
    expect(after?.rights).toEqual(before?.rights);
    expect(after?.status).toBe("published");
    expect(after?.chordPro).toBe(before?.chordPro);
    expect(after?.publishedAt).toEqual(before?.publishedAt);
  });

  it("só a administração classifica", async () => {
    const song = await publish(await createSong("Protegida"));
    const body = { liturgy: liturgy() };

    expect((await classify(song, body, song.revision, userA)).status).toBe(403);
    expect((await classify(song, body, song.revision, null)).status).toBe(401);
    expect((await CatalogSongModel.findOne({ id: song.id }).lean())?.liturgy).toBeUndefined();
  });

  it("exige a revisão e recusa uma revisão desatualizada", async () => {
    const song = await publish(await createSong("Concorrente"));
    const body = { liturgy: liturgy() };

    expect((await classify(song, body)).status).toBe(428);
    expect((await classify(song, body, song.revision)).status).toBe(200);
    const stale = await classify(song, { liturgy: liturgy({ moments: ["entrada"] }) }, song.revision);
    expect(stale.status).toBe(412);
    expect((await CatalogSongModel.findOne({ id: song.id }).lean())?.liturgy?.moments).toEqual(["comunhao"]);
  });

  it("valida a classificação no servidor", async () => {
    const song = await publish(await createSong("Validada"));
    const invalid: unknown[] = [
      { liturgy: liturgy({ moments: ["intervalo" as never] }) },
      { liturgy: liturgy({ category: "devotional" }) },
      { liturgy: liturgy({ themes: ["tema-livre" as never] }) },
      { liturgy: liturgy({ scripture: [{ book: "xx" as never, chapter: 1 }] }) },
      { liturgy: { ...liturgy(), rights: { shareChordPro: true } } },
      { liturgy: liturgy(), status: "published" },
    ];

    for (const body of invalid) {
      expect((await classify(song, body, song.revision)).status).toBe(400);
    }
    expect((await CatalogSongModel.findOne({ id: song.id }).lean())?.liturgy).toBeUndefined();
  });

  it("aceita classificação incompleta como rascunho, sempre não conferida", async () => {
    const song = await publish(await createSong("Incompleta"));
    const response = await classify(song, { liturgy: liturgy({ moments: [], editorialRationale: "", guidanceSource: "" }) }, song.revision);

    expect(response.status).toBe(200);
    const stored = await CatalogSongModel.findOne({ id: song.id }).lean();
    expect(stored?.liturgy).toMatchObject({ moments: [], editorialRationale: "", reviewStatus: "pending_review" });
  });

  it("remove a classificação quando recebe nulo", async () => {
    const song = await classified("Temporária");
    const response = await classify(song, { liturgy: null }, song.revision);

    expect(response.status).toBe(200);
    expect((await json<{ song: CatalogSong }>(response)).song.liturgy).toBeNull();
    expect(await CatalogSongModel.findOne({ id: song.id }).lean()).not.toHaveProperty("liturgy");
  });

  it("cria os índices de exploração litúrgica", async () => {
    const names = (await CatalogSongModel.collection.indexes()).map((index) => Object.keys(index.key).join(","));
    for (const field of ["moments", "seasons", "celebrations", "themes"]) {
      expect(names).toContain(`status,liturgy.${field},sortTitle,id`);
    }
  });
});

describe("exploração do catálogo", () => {
  beforeEach(async () => {
    await classified("Comunhão da Quaresma", { seasons: ["quaresma"], themes: ["misericordia", "perdao"] });
    await classified("Comunhão do Advento", { seasons: ["advento"], themes: ["esperanca"] });
    await classified("Entrada e Comunhão", { moments: ["entrada", "comunhao"], themes: ["misericordia"] });
    await classified("Hino do Coração", { moments: ["entrada"], celebrations: ["sagrado-coracao", "corpus-christi"] });
    await publish(await createSong("Sem Classificação"));
  });

  it("combina momento, tempo e tema", async () => {
    const result = await search("moment=comunhao&season=quaresma&theme=misericordia");
    expect(result.body.songs.map((song) => song.title)).toEqual(["Comunhão da Quaresma"]);
    expect(result.body.total).toBe(1);
  });

  it("uma música com vários momentos aparece em cada um deles", async () => {
    const communion = await search("moment=comunhao");
    const entrance = await search("moment=entrada");

    expect(communion.body.songs.map((song) => song.title)).toEqual([
      "Comunhão da Quaresma",
      "Comunhão do Advento",
      "Entrada e Comunhão",
    ]);
    expect(entrance.body.songs.map((song) => song.title)).toEqual(["Entrada e Comunhão", "Hino do Coração"]);
    expect(entrance.body.songs[0].moments).toEqual(["entrada", "comunhao"]);
  });

  it("filtra por celebração e por tema, e combina com a busca por texto", async () => {
    expect((await search("celebration=corpus-christi")).body.songs.map((song) => song.title)).toEqual(["Hino do Coração"]);
    expect((await search("theme=misericordia")).body.total).toBe(2);
    expect((await search("theme=misericordia&q=entrada")).body.songs.map((song) => song.title)).toEqual(["Entrada e Comunhão"]);
    expect((await search("celebration=pentecostes")).body.total).toBe(0);
  });

  it("sem filtros, lista também as músicas não classificadas", async () => {
    const all = await search("");
    expect(all.body.total).toBe(5);
    expect(all.body.songs.find((song) => song.title === "Sem Classificação")?.moments).toEqual([]);
  });

  it("pagina dentro do filtro", async () => {
    const first = await search("moment=comunhao&pageSize=2");
    const second = await search("moment=comunhao&pageSize=2&page=2");

    expect(first.body).toMatchObject({ total: 3, totalPages: 2 });
    expect(first.body.songs).toHaveLength(2);
    expect(second.body.songs.map((song) => song.title)).toEqual(["Entrada e Comunhão"]);
  });

  it("recusa filtros fora dos vocabulários", async () => {
    for (const query of ["moment=intervalo", "season=verao", "theme=", "celebration[$ne]=x", "moment=comunhao&extra=1"]) {
      expect((await search(query)).status).toBe(400);
    }
  });

  it("rascunhos e despublicadas não aparecem, mesmo classificadas", async () => {
    const draft = await createSong("Rascunho Classificado");
    expect((await classify(draft, { liturgy: liturgy({ seasons: ["quaresma"] }) }, draft.revision)).status).toBe(200);
    const gone = await classified("Vai Sair", { seasons: ["quaresma"] });
    await adminUnpublishRoute.POST(request(admin, "POST", undefined, gone.revision), params({ id: gone.id }));

    expect((await search("season=quaresma")).body.songs.map((song) => song.title)).toEqual(["Comunhão da Quaresma"]);
  });

  it("a leitura pública traz a classificação, sem justificativa, evidência ou autoria", async () => {
    const song = await classified("Pública", { themes: ["eucaristia"], suitabilityNotes: "Para a comunhão." });
    const response = await publicSongRoute.GET(new Request(`${ORIGIN}/x`), params({ id: song.id }));
    const text = await response.text();

    expect(JSON.parse(text).song.liturgy).toMatchObject({
      category: "liturgical",
      moments: ["comunhao"],
      themes: ["eucaristia"],
      suitabilityNotes: "Para a comunhão.",
    });
    expect(text).not.toContain("JUSTIFICATIVA INTERNA");
    expect(text).not.toContain("EVIDENCIA INTERNA");
    expect(text).not.toContain("classifiedBy");
    expect(text).not.toContain(admin.id);
  });
});

describe("calendário e sugestões", () => {
  async function celebrations(query: string) {
    const response = await celebrationsRoute.GET(new Request(`${ORIGIN}/api/v1/liturgy/celebrations${query}`), params({}));
    return { status: response.status, body: await json<unknown>(response), headers: response.headers };
  }

  it("devolve a celebração de uma data coberta, com a origem dos dados", async () => {
    const { status, body, headers } = await celebrations("?date=2026-11-22");
    const celebration = (body as { celebration: Record<string, unknown> }).celebration;

    expect(status).toBe(200);
    expect(headers.get("cache-control")).toBe("no-store");
    expect(celebration).toMatchObject({
      title: "Nosso Senhor Jesus Cristo, Rei do Universo",
      calendar: "rito-romano-brasil",
      locale: "pt-BR",
      season: "tempo-comum",
      celebrations: ["cristo-rei"],
    });
    expect((celebration.sources as unknown[]).length).toBeGreaterThan(0);
    expect((celebration.readings as { role: string }[]).map((reading) => reading.role)).toEqual(["first", "psalm", "second", "gospel"]);
  });

  it("data não coberta responde 404, sem leitura estimada", async () => {
    const { status, body } = await celebrations("?date=2026-11-16");
    expect(status).toBe(404);
    expect(JSON.stringify(body)).not.toContain("readings");
    expect((await suggestions("date=2026-11-16")).status).toBe(404);
  });

  it("valida os parâmetros", async () => {
    expect((await celebrations("?date=16/11/2026")).status).toBe(400);
    expect((await celebrations("?date=2026-02-30")).status).toBe(400);
    expect((await celebrations("?data=2026-11-22")).status).toBe(400);
    expect((await suggestions("date=2026-11-22&moment=intervalo")).status).toBe(400);
    expect((await suggestions("moment=comunhao")).status).toBe(400);
  });

  it("sem data, informa a cobertura real da base, paginada", async () => {
    const { body } = await celebrations("");
    const page = body as { celebrations: { date: string }[]; total: number; pageSize: number };
    expect(page.total).toBe(9);
    expect(page.celebrations.map((entry) => entry.date)).toContain("2026-11-15");
    expect(page.celebrations.length).toBeLessThanOrEqual(page.pageSize);
  });

  it("sugere só músicas publicadas, litúrgicas e do momento, na ordem de prioridade", async () => {
    await classified("Pastor que Reina", {
      seasons: ["tempo-comum"],
      celebrations: ["cristo-rei"],
      themes: ["bom-pastor"],
      scripture: [{ book: "sl", chapter: 23 }],
    });
    await classified("Mesa do Caminho", { themes: ["caridade"] });
    await classified("Abre a Mesa");
    await classified("Canto de Pentecostes", { celebrations: ["pentecostes"] });
    await classified("Canto Pascal", { seasons: ["pascoa"], themes: ["bom-pastor", "caridade", "reino-de-deus"] });
    await classified("Canto Devocional", { category: "devotional", moments: [], themes: ["bom-pastor", "caridade"] });
    await classified("Só Entrada", { moments: ["entrada"], celebrations: ["cristo-rei"] });
    await publish(await createSong("Sem Classificação"));
    const draft = await createSong("Rascunho");
    await classify(draft, { liturgy: liturgy({ celebrations: ["cristo-rei"] }) }, draft.revision);

    const { status, body } = await suggestions("date=2026-11-22&moment=comunhao");

    expect(status).toBe(200);
    expect(body.moments.map((entry) => entry.moment)).toEqual(["comunhao"]);
    expect(titlesFor(body.moments, "comunhao")).toEqual(["Pastor que Reina", "Mesa do Caminho", "Abre a Mesa"]);
    expect(body.moments[0].suggestions[0].reasons.map((reason) => reason.text)).toEqual([
      "Adequada à Comunhão",
      "Associada à celebração: Cristo Rei",
      "Relacionada ao salmo responsorial (Sl 22(23),1-2a.2b-3.5-6)",
      "Indicada para o Tempo Comum",
      "Relacionada ao tema: bom pastor",
    ]);
    expect(body.moments[0].suggestions[0].basis).toBe("editorial");
    const text = JSON.stringify(body);
    expect(text).not.toContain("JUSTIFICATIVA INTERNA");
    expect(text).not.toContain("Letra de");
    expect(text).not.toContain("EVIDENCIA");
  });

  it("aplica as restrições do tempo: Glória omitido no Advento e canto do Advento só no Advento", async () => {
    await classified("Vigias da Aurora", { moments: ["entrada"], seasons: ["advento"], themes: ["vigilancia"] });
    await classified("Glória Fictício", { moments: ["gloria"] });
    await classified("Aleluia Fictício", { moments: ["aclamacao-ao-evangelho"], avoidSeasons: ["quaresma"] });

    const advent = (await suggestions("date=2026-11-29")).body.moments;
    const ordinary = (await suggestions("date=2026-11-15")).body.moments;
    const solemnityInAdvent = (await suggestions("date=2026-12-08")).body.moments;

    expect(titlesFor(advent, "entrada")).toEqual(["Vigias da Aurora"]);
    expect(titlesFor(ordinary, "entrada")).toEqual([]);
    expect(advent.find((entry) => entry.moment === "gloria")).toMatchObject({ guidance: { status: "omitted" }, total: 0 });
    expect(titlesFor(ordinary, "gloria")).toEqual(["Glória Fictício"]);
    // Solenidade dentro do Advento: o Glória é cantado.
    expect(titlesFor(solemnityInAdvent, "gloria")).toEqual(["Glória Fictício"]);
    expect(titlesFor(advent, "aclamacao-ao-evangelho")).toEqual(["Aleluia Fictício"]);
  });

  it("sem música pertinente, a resposta vem vazia; despublicar retira a sugestão", async () => {
    expect((await suggestions("date=2026-11-22")).body.moments.every((entry) => entry.total === 0)).toBe(true);

    const song = await classified("Some Depois");
    expect(titlesFor((await suggestions("date=2026-11-22")).body.moments, "comunhao")).toEqual(["Some Depois"]);
    await adminUnpublishRoute.POST(request(admin, "POST", undefined, song.revision), params({ id: song.id }));
    expect(titlesFor((await suggestions("date=2026-11-22")).body.moments, "comunhao")).toEqual([]);
  });
});

describe("repertório da missa", () => {
  const MASS = { date: "2026-11-22", celebrationId: "2026-11-22-cristo-rei", title: "Cristo Rei" };

  async function createRepertoire(user: TestUser, body: unknown): Promise<Response> {
    return repertoiresRoute.POST(request(user, "POST", body), params({}));
  }

  async function addItem(user: TestUser, repertoire: Repertoire, body: unknown): Promise<Response> {
    return itemsRoute.POST(request(user, "POST", body, repertoire.revision), params({ id: repertoire.id }));
  }

  async function massRepertoire(): Promise<Repertoire> {
    const response = await createRepertoire(userA, { name: "Missa", description: "", mass: MASS });
    expect(response.status).toBe(201);
    return (await json<{ repertoire: Repertoire }>(response)).repertoire;
  }

  it("cria a partir de uma celebração e valida os dados da missa", async () => {
    const repertoire = await massRepertoire();
    expect(repertoire.mass).toEqual(MASS);
    expect((await RepertoireModel.findOne({ id: repertoire.id }).lean())?.mass).toEqual(MASS);

    expect((await createRepertoire(userA, { name: "X", description: "", mass: { ...MASS, date: "2026-02-30" } })).status).toBe(400);
    expect((await createRepertoire(userA, { name: "X", description: "", mass: { ...MASS, title: "" } })).status).toBe(400);
    expect((await createRepertoire(userA, { name: "X", description: "", mass: { ...MASS, ownerId: userB.id } })).status).toBe(400);
    expect((await createRepertoire(userA, { name: "Ensaio", description: "" })).status).toBe(201);
  });

  it("adiciona a música sugerida com o momento, na ordem da missa, e o tom fica no item", async () => {
    const communion = await classified("Comunhão");
    const entrance = await classified("Entrada", { moments: ["entrada"] });
    let repertoire = await massRepertoire();

    repertoire = (await json<{ repertoire: Repertoire }>(
      await addItem(userA, repertoire, { songId: communion.id, source: "catalog", moment: "comunhao" }),
    )).repertoire;
    repertoire = (await json<{ repertoire: Repertoire }>(
      await addItem(userA, repertoire, { songId: entrance.id, source: "catalog", moment: "entrada" }),
    )).repertoire;
    expect(repertoire.items.map((item) => [item.songId, item.moment, item.position])).toEqual([
      [entrance.id, "entrada", 1],
      [communion.id, "comunhao", 2],
    ]);

    const toned = await itemRoute.PATCH(
      request(userA, "PATCH", { transposeSemitones: 3 }, repertoire.revision),
      params({ id: repertoire.id, itemId: repertoire.items[1].id }),
    );
    expect(toned.status).toBe(200);
    repertoire = (await json<{ repertoire: Repertoire }>(toned)).repertoire;
    expect(repertoire.items[1]).toMatchObject({ moment: "comunhao", transposeSemitones: 3, source: "catalog" });

    const stored = await RepertoireModel.findOne({ id: repertoire.id }).lean();
    expect(JSON.stringify(stored)).not.toContain("Letra de");
    expect((await CatalogSongModel.findOne({ id: communion.id }).lean())?.originalKey).toBe("C");
  });

  it("valida o momento e respeita a revisão ao alterá-lo", async () => {
    const song = await classified("Comunhão");
    let repertoire = await massRepertoire();

    expect((await addItem(userA, repertoire, { songId: song.id, source: "catalog", moment: "intervalo" })).status).toBe(400);
    repertoire = (await json<{ repertoire: Repertoire }>(
      await addItem(userA, repertoire, { songId: song.id, source: "catalog", moment: "comunhao" }),
    )).repertoire;
    const item = repertoire.items[0];
    const patch = (body: unknown, revision: number) =>
      itemRoute.PATCH(request(userA, "PATCH", body, revision), params({ id: repertoire.id, itemId: item.id }));

    expect((await patch({ moment: "intervalo" }, repertoire.revision)).status).toBe(400);
    expect((await patch({ moment: "acao-de-gracas" }, repertoire.revision)).status).toBe(200);
    expect((await patch({ moment: null }, repertoire.revision)).status).toBe(412);
    expect((await RepertoireModel.findOne({ id: repertoire.id }).lean())?.items[0].moment).toBe("acao-de-gracas");
    expect((await patch({ moment: null }, repertoire.revision + 1)).status).toBe(200);
    expect((await RepertoireModel.findOne({ id: repertoire.id }).lean())?.items[0]).not.toHaveProperty("moment");
  });

  it("editar o nome mantém a missa; só um pedido explícito desvincula", async () => {
    const repertoire = await massRepertoire();
    const put = (body: unknown, revision: number) =>
      repertoireRoute.PUT(request(userA, "PUT", body, revision), params({ id: repertoire.id }));

    const renamed = await json<{ repertoire: Repertoire }>(await put({ name: "Missa das 10h", description: "" }, 1));
    expect(renamed.repertoire.mass).toEqual(MASS);

    const unlinked = await json<{ repertoire: Repertoire }>(await put({ name: "Ensaio", description: "", mass: null }, 2));
    expect(unlinked.repertoire).not.toHaveProperty("mass");
    expect(await RepertoireModel.findOne({ id: repertoire.id }).lean()).not.toHaveProperty("mass");
  });

  it("repertório antigo continua válido e não vira repertório de missa", async () => {
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
      items: [{ id: "item-antigo", songId: personal.id, position: 1, transposeSemitones: 2 }],
    });

    const listed = await json<{ repertoires: Repertoire[] }>(await repertoiresRoute.GET(request(userA, "GET"), params({})));
    expect(listed.repertoires[0]).not.toHaveProperty("mass");
    expect(listed.repertoires[0].items[0]).toEqual({
      id: "item-antigo",
      songId: personal.id,
      source: "personal",
      position: 1,
      transposeSemitones: 2,
    });

    const updated = await library.repertoires.updateItem("rep-antigo", "item-antigo", { transposeSemitones: -1 }, 1);
    expect(updated.items[0]).not.toHaveProperty("moment");
    const raw = await RepertoireModel.findOne({ id: "rep-antigo" }).lean();
    expect(raw).not.toHaveProperty("mass");
    expect(raw?.items[0]).not.toHaveProperty("moment");
  });

  it("uma conta não cria nem altera o repertório de missa de outra", async () => {
    const song = await classified("Comunhão");
    const repertoire = await massRepertoire();

    expect((await addItem(userB, repertoire, { songId: song.id, source: "catalog", moment: "comunhao" })).status).toBe(404);
    expect((await addItem(null as never, repertoire, { songId: song.id, source: "catalog" })).status).toBe(401);
    expect((await RepertoireModel.findOne({ id: repertoire.id }).lean())?.items).toEqual([]);
  });
});

describe("compartilhamento e backup", () => {
  const MASS = { date: "2026-11-22", celebrationId: "2026-11-22-cristo-rei", title: "Cristo Rei" };

  async function setup() {
    const shareable = await classified("Com Direito");
    const displayOnly = await classified("Só Exibição", { moments: ["entrada"] }, { shareChordPro: false });
    const library = createLibraryService(userA.id);
    const created = await library.repertoires.create({ name: "Missa de Cristo Rei", description: "", mass: MASS });
    const first = await library.repertoires.addSong(created.id, shareable.id, created.revision, "catalog", "comunhao");
    const second = await library.repertoires.addSong(created.id, displayOnly.id, first.revision, "catalog", "entrada");
    const noted = await library.repertoires.updateItem(
      created.id,
      second.items[1].id,
      { notes: "ANOTACAO PRIVADA", transposeSemitones: 2 },
      second.revision,
    );
    return { library, repertoire: noted };
  }

  async function publishShare(library: ReturnType<typeof createLibraryService>, repertoireId: string, selection: ShareSelection) {
    const { contentHash } = await library.shares.preview(repertoireId, selection);
    return library.shares.create(repertoireId, { ...selection, expectedHash: contentHash });
  }

  async function openPublic(path: string | null): Promise<{ status: number; text: string; share: PublicShareSnapshot }> {
    const token = (path ?? "").replace("/s/", "");
    const response = await publicShareRoute.GET(new Request(`${ORIGIN}/api/v1/public/shares/${token}`), params({ token }));
    const text = await response.text();
    return { status: response.status, text, share: response.ok ? JSON.parse(text).share : undefined };
  }

  it("publica a celebração, os momentos e os tons; a data só por escolha", async () => {
    const { library, repertoire } = await setup();

    const withoutDate = await publishShare(library, repertoire.id, { authorizations: [] });
    const withDate = await publishShare(library, repertoire.id, { authorizations: [], includeMassDate: true });

    const first = await openPublic(withoutDate.path);
    expect(first.status).toBe(200);
    expect(first.share.mass).toEqual({ title: "Cristo Rei" });
    expect(first.text).not.toContain("2026-11-22");
    expect(first.share.items.map((item) => [item.title, item.moment, item.transposeSemitones, item.content.kind])).toEqual([
      ["Só Exibição", "entrada", 0, "none"],
      ["Com Direito", "comunhao", 2, "chordpro"],
    ]);

    const second = await openPublic(withDate.path);
    expect(second.share.mass).toEqual({ title: "Cristo Rei", date: "2026-11-22" });
    expect(withoutDate.includeMassDate).toBe(false);
    expect(withDate.includeMassDate).toBe(true);
  });

  it("não publica anotações, referências internas, evidências nem dados de conta", async () => {
    const { library, repertoire } = await setup();
    const summary = await publishShare(library, repertoire.id, { authorizations: [], includeMassDate: true });
    const { text } = await openPublic(summary.path);

    for (const secret of ["ANOTACAO PRIVADA", "celebrationId", MASS.celebrationId, "EVIDENCIA", "JUSTIFICATIVA", userA.id, userA.email, repertoire.id]) {
      expect(text).not.toContain(secret);
    }
    // A cifra sem direito de redistribuição continua fora.
    expect(text).not.toContain("Letra de Só Exibição");
  });

  it("a escolha da data fica registrada: a publicação não aparece como desatualizada", async () => {
    const { library, repertoire } = await setup();
    await publishShare(library, repertoire.id, { authorizations: [], includeMassDate: true });
    await publishShare(library, repertoire.id, { authorizations: [] });

    const summaries = await library.shares.listForRepertoire(repertoire.id);
    expect(summaries.map((summary) => summary.outdated)).toEqual([false, false]);
    expect(await RepertoireShareModel.countDocuments({ includeMassDate: true })).toBe(1);

    // Mudar o momento de um item muda o conteúdo: as publicações passam a estar desatualizadas.
    await library.repertoires.updateItem(repertoire.id, repertoire.items[0].id, { moment: "encerramento" }, repertoire.revision);
    const after = await library.shares.listForRepertoire(repertoire.id);
    expect(after.map((summary) => summary.outdated)).toEqual([true, true]);
  });

  it("repertório sem missa é publicado como antes", async () => {
    const library = createLibraryService(userA.id);
    const personal = await library.songs.create(hostedSong);
    const repertoire = await library.repertoires.create({ name: "Ensaio", description: "" });
    await library.repertoires.addSong(repertoire.id, personal.id, repertoire.revision);

    const summary = await publishShare(library, repertoire.id, { authorizations: [], includeMassDate: true });
    const { share } = await openPublic(summary.path);

    expect(share).not.toHaveProperty("mass");
    expect(share.items[0]).not.toHaveProperty("moment");
  });

  it("backup: versão 3 com a missa e os momentos, restaurada em outra conta", async () => {
    const { repertoire } = await setup();
    const { backup } = await json<{ backup: { schemaVersion: number; repertoires: Repertoire[] } }>(
      await exportRoute.GET(request(userA, "GET"), params({})),
    );

    expect(backup.schemaVersion).toBe(3);
    expect(backup.repertoires[0].mass).toEqual(MASS);
    expect(backup.repertoires[0].items.map((item) => item.moment)).toEqual(["entrada", "comunhao"]);
    expect(JSON.stringify(backup)).not.toContain("Letra de");

    const restored = await createLibraryService(userB.id).imports.execute({ importId: crypto.randomUUID(), backup } as never);
    expect(restored.summary).toMatchObject({ repertoires: 1 });
    const copy = await RepertoireModel.findOne({ ownerId: userB.id }).lean();
    expect(copy?.mass).toEqual(MASS);
    expect(copy?.items.map((item) => [item.moment, item.source, item.transposeSemitones])).toEqual([
      ["entrada", "catalog", 0],
      ["comunhao", "catalog", 2],
    ]);
    expect(copy?.id).toBe(repertoire.id);
  });

  it("backup: versões 1 e 2 continuam aceitas, e dados de missa nelas são recusados", async () => {
    const dates = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
    const song = { ...dates, ...hostedSong, id: "s1" };
    const item = { id: "i1", songId: "s1", position: 1, transposeSemitones: 0 };
    const v1 = { schemaVersion: 1, songs: [song], repertoires: [{ ...dates, id: "r1", name: "Antigo", description: "", items: [item] }] };
    const v2WithMass = {
      schemaVersion: 2,
      songs: [song],
      repertoires: [{ ...dates, id: "r1", name: "X", description: "", mass: MASS, items: [{ ...item, source: "personal" }] }],
    };

    await expect(
      createLibraryService(userB.id).imports.execute({ importId: crypto.randomUUID(), backup: v2WithMass } as never),
    ).rejects.toMatchObject({ code: "invalid-data" });
    expect(await RepertoireModel.countDocuments({ ownerId: userB.id })).toBe(0);

    const restored = await createLibraryService(userB.id).imports.execute({ importId: crypto.randomUUID(), backup: v1 } as never);
    expect(restored.summary).toMatchObject({ songs: 1, repertoires: 1 });
    expect(await RepertoireModel.findOne({ ownerId: userB.id }).lean()).not.toHaveProperty("mass");
  });
});
