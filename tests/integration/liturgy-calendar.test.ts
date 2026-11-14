import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as qualityRoute from "@/app/api/v1/admin/catalog/quality/route";
import * as classificationRoute from "@/app/api/v1/admin/catalog/songs/[id]/classification/route";
import * as classificationReviewRoute from "@/app/api/v1/admin/catalog/songs/[id]/classification/review/route";
import * as adminPublishRoute from "@/app/api/v1/admin/catalog/songs/[id]/publish/route";
import * as adminUnpublishRoute from "@/app/api/v1/admin/catalog/songs/[id]/unpublish/route";
import * as adminSongsRoute from "@/app/api/v1/admin/catalog/songs/route";
import * as historyRoute from "@/app/api/v1/admin/liturgy/celebrations/[id]/history/route";
import * as reviewRoute from "@/app/api/v1/admin/liturgy/celebrations/[id]/review/route";
import * as adminCelebrationRoute from "@/app/api/v1/admin/liturgy/celebrations/[id]/route";
import * as adminCelebrationsRoute from "@/app/api/v1/admin/liturgy/celebrations/route";
import * as itemRoute from "@/app/api/v1/library/repertoires/[id]/items/[itemId]/route";
import * as itemsRoute from "@/app/api/v1/library/repertoires/[id]/items/route";
import * as repertoiresRoute from "@/app/api/v1/library/repertoires/route";
import * as publicCelebrationRoute from "@/app/api/v1/liturgy/celebrations/[id]/route";
import * as celebrationsRoute from "@/app/api/v1/liturgy/celebrations/route";
import * as suggestionsRoute from "@/app/api/v1/liturgy/suggestions/route";
import * as publicShareRoute from "@/app/api/v1/public/shares/[token]/route";
import type { CatalogSong, CatalogSongInput } from "@/features/catalog/domain/catalog-song";
import type { CelebrationSource } from "@/features/liturgy/domain/calendar";
import type { CelebrationInput, CelebrationRecord } from "@/features/liturgy/domain/celebration-record";
import type { SongClassificationInput } from "@/features/liturgy/domain/classification";
import type { MomentSuggestions } from "@/features/liturgy/domain/recommendation";
import type { Repertoire } from "@/features/repertoires/domain/repertoire";
import type { PublicShareSnapshot } from "@/features/sharing/domain/public-share";
import { CelebrationHistoryModel } from "@/server/database/models/liturgical-celebration-history-model";
import { LiturgicalCelebrationModel } from "@/server/database/models/liturgical-celebration-model";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { resetRateLimitsForTests } from "@/server/http/rate-limit";
import { createLibraryService } from "@/server/library/library-service";

import {
  clearDatabase,
  createTestUser,
  dropTestDatabase,
  importEditorialCelebrations,
  ORIGIN,
  runScript,
  type TestUser,
} from "./helpers";

const SECRET = "chave-de-integracao-com-mais-de-32-caracteres";

let admin: TestUser;
let userA: TestUser;

function request(user: TestUser | null, method: string, path = "/x", body?: unknown, revision?: number): Request {
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
const json = async <T>(response: Response) => (await response.json()) as T;

const SOURCE: CelebrationSource = {
  id: "fonte-teste",
  provider: "Fonte de teste",
  documentTitle: "Documento fictício para os testes de integração",
  accessedAt: "2026-11-14",
  jurisdiction: "BR",
  scope: ["title", "rank", "season", "color", "first", "psalm", "gospel"],
  verificationStatus: "human-check",
};

/** Celebração de teste, explicitamente fictícia: não representa nenhuma data real verificada. */
function testCelebration(fields: Partial<CelebrationInput> = {}): CelebrationInput {
  return {
    date: "2031-03-02",
    country: "BR",
    scope: "national",
    celebrationKey: "celebracao-de-teste",
    massVariant: "principal",
    title: "[TESTE] Celebração fictícia",
    rank: "domingo",
    season: "tempo-comum",
    lectionaryCycle: { sunday: "A", weekday: null },
    liturgicalColor: { color: "verde" },
    readings: [
      { role: "first", citation: "Is 55,1-3", ranges: [{ book: "is", chapter: 55, verseStart: 1, verseEnd: 3 }] },
      { role: "psalm", citation: "Sl 22(23)", ranges: [{ book: "sl", chapter: 23 }] },
      { role: "gospel", citation: "Jo 6,51-58", ranges: [{ book: "jo", chapter: 6, verseStart: 51, verseEnd: 58 }] },
    ],
    unverifiedReadings: [],
    celebrations: [],
    biblicalThemes: ["eucaristia"],
    notes: [],
    sources: [SOURCE],
    ...fields,
  };
}

async function create(input: CelebrationInput, user = admin): Promise<Response> {
  return adminCelebrationsRoute.POST(request(user, "POST", "/x", { celebration: input }), params({}));
}

async function created(input: CelebrationInput = testCelebration()): Promise<CelebrationRecord> {
  const response = await create(input);
  expect(response.status).toBe(201);
  return (await json<{ celebration: CelebrationRecord }>(response)).celebration;
}

function review(record: Pick<CelebrationRecord, "id" | "revision">, body: unknown, user: TestUser | null = admin, revision: number | undefined = record.revision) {
  return reviewRoute.POST(request(user, "POST", "/x", body, revision), params({ id: record.id }));
}

const APPROVE = { action: "approve", humanReviewConfirmed: true, sourceIds: ["fonte-teste"] };

async function approved(record: CelebrationRecord, sourceIds = ["fonte-teste"]): Promise<CelebrationRecord> {
  const response = await review(record, { ...APPROVE, sourceIds });
  expect(response.status).toBe(200);
  return (await json<{ celebration: CelebrationRecord }>(response)).celebration;
}

async function publicById(id: string) {
  const response = await publicCelebrationRoute.GET(new Request(`${ORIGIN}/x`), params({ id }));
  return { status: response.status, text: await response.clone().text(), body: await json<{ celebration: Record<string, never> }>(response) };
}

async function byDate(date: string) {
  const response = await celebrationsRoute.GET(new Request(`${ORIGIN}/api/v1/liturgy/celebrations?date=${date}`), params({}));
  return { status: response.status, body: await json<{ celebration: { celebrationId: string }; celebrations: { celebrationId: string; massVariant: string }[] }>(response) };
}

async function search(query: string) {
  const response = await celebrationsRoute.GET(new Request(`${ORIGIN}/api/v1/liturgy/celebrations?${query}`), params({}));
  return { status: response.status, body: await json<{ celebrations: { date: string; title: string; reviewStatus: string }[]; total: number; totalPages: number }>(response) };
}

async function suggestions(query: string) {
  const response = await suggestionsRoute.GET(new Request(`${ORIGIN}/api/v1/liturgy/suggestions?${query}`), params({}));
  return {
    status: response.status,
    body: await json<{ assurance: string; cautions: string[]; moments: MomentSuggestions[]; celebration: { reviewStatus: string; revision: number } }>(response),
  };
}

const titles = (moments: MomentSuggestions[], moment: string) =>
  moments.find((entry) => entry.moment === moment)?.suggestions.map((entry) => entry.song.title) ?? [];

beforeEach(async () => {
  resetRateLimitsForTests();
  vi.stubEnv("PUBLIC_SHARING_ENABLED", "true");
  vi.stubEnv("SHARE_LINK_SECRET", SECRET);
  await clearDatabase();
  admin = await createTestUser("admin");
  userA = await createTestUser("usuaria-a");
  await runScript("catalog-admin.mjs", "grant", "--email", admin.email);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(dropTestDatabase);

describe("A. importação editorial", () => {
  it("importa as nove celebrações, todas em revisão, com histórico", async () => {
    expect(await importEditorialCelebrations()).toContain("9 celebração(ões) importada(s) em revisão; 0 já existiam");

    const documents = await LiturgicalCelebrationModel.find({}).sort({ date: 1 }).lean();
    expect(documents.map((document) => document.date)).toEqual([
      "2026-11-15",
      "2026-11-22",
      "2026-11-29",
      "2026-12-06",
      "2026-12-08",
      "2026-12-13",
      "2026-12-20",
      "2026-12-25",
      "2027-01-01",
    ]);
    expect(new Set(documents.map((document) => document.reviewStatus))).toEqual(new Set(["pending_review"]));
    expect(documents.every((document) => document.revision === 1 && document.approval === null)).toBe(true);
    expect(documents.find((document) => document.date === "2026-12-25")?.massVariant).toBe("noite");

    const history = await CelebrationHistoryModel.find({}).lean();
    expect(history).toHaveLength(9);
    expect(history.every((entry) => entry.action === "import" && entry.toStatus === "pending_review" && entry.actor === "importacao-editorial")).toBe(true);
  });

  it("é idempotente e nunca sobrescreve o que a administração fez", async () => {
    await importEditorialCelebrations();
    const king = await LiturgicalCelebrationModel.findOne({ id: "2026-11-22-cristo-rei" }).lean();
    await approved({ id: king!.id, revision: king!.revision } as CelebrationRecord, ["cancao-nova"]);

    expect(await importEditorialCelebrations()).toContain("0 celebração(ões) importada(s) em revisão; 9 já existiam e não foram alteradas");
    expect(await LiturgicalCelebrationModel.countDocuments({})).toBe(9);
    const after = await LiturgicalCelebrationModel.findOne({ id: "2026-11-22-cristo-rei" }).lean();
    expect(after).toMatchObject({ reviewStatus: "reviewed", revision: 2 });
    expect(await CelebrationHistoryModel.countDocuments({ action: "import" })).toBe(9);
  });

  it("preserva os salmos não conferidos e as fontes, sem estimativa", async () => {
    await importEditorialCelebrations();
    for (const id of ["2026-12-20-4-domingo-advento", "2026-12-25-natal-missa-da-noite"]) {
      const { body } = await publicById(id);
      expect(body.celebration).toMatchObject({ unverifiedReadings: ["psalm"], review: { status: "pending_review" } });
      expect((body.celebration.readings as unknown as { role: string }[]).map((reading) => reading.role)).toEqual(["first", "second", "gospel"]);
    }
    const advent = await publicById("2026-12-06-2-domingo-advento");
    expect(advent.body.celebration.sources).toHaveLength(1);
    expect(advent.text).toContain("Fonte dos Estados Unidos, usada só para as referências das leituras");
  });

  it("recusa produção", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(runScript("import-liturgical-celebrations.mjs")).rejects.toMatchObject({ code: 1 });
    expect(await LiturgicalCelebrationModel.countDocuments({})).toBe(0);
  });
});

describe("B. revisão", () => {
  it("cria, aprova, publica pela API e exige nova revisão depois de editar", async () => {
    const record = await created();
    expect(record).toMatchObject({ reviewStatus: "pending_review", revision: 1, approval: null });

    const approvedRecord = await approved(record);
    expect(approvedRecord).toMatchObject({
      reviewStatus: "reviewed",
      revision: 2,
      approval: { by: admin.id, revision: 1, sourceIds: ["fonte-teste"] },
    });

    const visible = await publicById(record.id);
    expect(visible.body.celebration).toMatchObject({ review: { status: "reviewed", disputedFields: [] }, revision: 2 });
    expect(visible.text).not.toContain(admin.id);

    const edited = await adminCelebrationRoute.PUT(
      request(admin, "PUT", "/x", { celebration: testCelebration({ biblicalThemes: ["eucaristia", "gratidao"] }) }, 2),
      params({ id: record.id }),
    );
    expect(edited.status).toBe(200);
    const after = (await json<{ celebration: CelebrationRecord }>(edited)).celebration;
    expect(after).toMatchObject({ reviewStatus: "pending_review", approval: null, revision: 3 });
    expect((await publicById(record.id)).body.celebration).toMatchObject({ review: { status: "pending_review", reviewedAt: null } });

    const history = (await json<{ history: { action: string; changedFields: string[]; approvedRevision?: number; fromStatus: string | null; toStatus: string }[] }>(
      await historyRoute.GET(request(admin, "GET"), params({ id: record.id })),
    )).history;
    expect(history.map((entry) => [entry.action, entry.fromStatus, entry.toStatus])).toEqual([
      ["update", "reviewed", "pending_review"],
      ["approve", "pending_review", "reviewed"],
      ["create", null, "pending_review"],
    ]);
    expect(history[0].changedFields).toEqual(["biblicalThemes"]);
    expect(history[1].approvedRevision).toBe(1);
    const stored = await CelebrationHistoryModel.findOne({ celebrationId: record.id, action: "update" }).lean();
    expect(stored?.content?.biblicalThemes).toEqual(["eucaristia", "gratidao"]);
  });

  it("aprovação exige conferência humana declarada e fontes registradas", async () => {
    const record = await created();
    expect((await review(record, { ...APPROVE, humanReviewConfirmed: false })).status).toBe(400);
    expect((await review(record, { action: "approve", sourceIds: ["fonte-teste"] })).status).toBe(400);
    expect((await review(record, { ...APPROVE, sourceIds: ["inventada"] })).status).toBe(400);
    expect((await LiturgicalCelebrationModel.findOne({ id: record.id }).lean())?.reviewStatus).toBe("pending_review");
  });

  it("revisão desatualizada é recusada; sem If-Match também", async () => {
    const record = await created();
    const withoutRevision = await reviewRoute.POST(request(admin, "POST", "/x", APPROVE), params({ id: record.id }));
    expect(withoutRevision.status).toBe(428);
    await approved(record);
    expect((await review(record, { action: "reopen", note: "Nova fonte." })).status).toBe(412);
    const stale = await adminCelebrationRoute.PUT(request(admin, "PUT", "/x", { celebration: testCelebration({ title: "[TESTE] Outro" }) }, 1), params({ id: record.id }));
    expect(stale.status).toBe(412);
  });

  it("divergência bloqueia aprovação até ser resolvida; reabrir só vale para revisada", async () => {
    const record = await created();
    expect((await review(record, { action: "reopen", note: "x" })).status).toBe(400);

    const disputed = (await json<{ celebration: CelebrationRecord }>(
      await review(record, { action: "dispute", fields: ["psalm"], note: "NOTA INTERNA: outro salmo no Diretório." }),
    )).celebration;
    expect(disputed).toMatchObject({ reviewStatus: "disputed", dispute: { fields: ["psalm"] } });
    expect((await review(disputed, APPROVE)).status).toBe(400);

    const visible = await publicById(record.id);
    expect(visible.body.celebration).toMatchObject({ review: { status: "disputed", disputedFields: ["psalm"] } });
    expect(visible.text).not.toContain("NOTA INTERNA");

    const resolved = (await json<{ celebration: CelebrationRecord }>(await review(disputed, { action: "resolve", note: "Conferido." }))).celebration;
    expect(resolved).toMatchObject({ reviewStatus: "pending_review", dispute: null });
    const reviewed = await approved(resolved);
    const reopened = (await json<{ celebration: CelebrationRecord }>(await review(reviewed, { action: "reopen", note: "Fonte atualizada." }))).celebration;
    expect(reopened).toMatchObject({ reviewStatus: "needs_update", approval: null });
  });

  it("valida o conteúdo no servidor", async () => {
    expect((await create(testCelebration({ sources: [] }))).status).toBe(400);
    expect((await create(testCelebration({ sources: [{ ...SOURCE, jurisdiction: "other-country" }] }))).status).toBe(400);
    expect((await create({ ...testCelebration(), reviewStatus: "reviewed" } as CelebrationInput)).status).toBe(400);
    expect((await create(testCelebration({ date: "2031-02-30" }))).status).toBe(400);
    expect(await LiturgicalCelebrationModel.countDocuments({})).toBe(0);
  });
});

describe("C. autorização", () => {
  it("conta comum não cria, não edita, não aprova nem vê o histórico", async () => {
    const record = await created();
    expect((await create(testCelebration({ celebrationKey: "outra" }), userA)).status).toBe(403);
    expect((await review(record, APPROVE, userA)).status).toBe(403);
    expect((await review(record, APPROVE, null)).status).toBe(401);
    expect((await adminCelebrationsRoute.GET(request(userA, "GET"), params({}))).status).toBe(403);
    expect((await historyRoute.GET(request(userA, "GET"), params({ id: record.id }))).status).toBe(403);
    expect((await qualityRoute.GET(request(userA, "GET"), params({}))).status).toBe(403);
    expect((await LiturgicalCelebrationModel.findOne({ id: record.id }).lean())?.reviewStatus).toBe("pending_review");
  });

  it("visitante vê só os campos públicos", async () => {
    const record = await created();
    await review(record, { action: "dispute", fields: ["title"], note: "NOTA INTERNA" });
    const { text, body } = await publicById(record.id);

    for (const secret of ['"createdBy"', '"updatedBy"', '"approval"', '"dispute"', '"searchTokens"', '"dioceseKey"', '"_id"', "NOTA INTERNA", admin.id]) {
      expect(text).not.toContain(secret);
    }
    expect(Object.keys(body.celebration)).toContain("provenance");
  });
});

describe("D. calendário", () => {
  beforeEach(importEditorialCelebrations);

  it("data coberta, data sem cobertura e nada inventado", async () => {
    const covered = await byDate("2026-11-22");
    expect(covered.status).toBe(200);
    expect(covered.body.celebration.celebrationId).toBe("2026-11-22-cristo-rei");

    const uncovered = await byDate("2026-11-16");
    expect(uncovered.status).toBe(404);
    expect(JSON.stringify(uncovered.body)).not.toContain("readings");
    expect((await suggestions("date=2026-11-16")).status).toBe(404);
  });

  it("uma data com várias celebrações devolve todas, em ordem estável", async () => {
    const dayMass = await created(
      testCelebration({
        date: "2026-12-25",
        scope: "universal",
        celebrationKey: "natal-do-senhor",
        massVariant: "dia",
        title: "[TESTE] Natal do Senhor",
        rank: "solenidade",
        season: "natal",
        lectionaryCycle: { sunday: "B", weekday: null },
        liturgicalColor: { color: "branco" },
      }),
    );
    const { body } = await byDate("2026-12-25");
    expect(body.celebrations.map((entry) => entry.massVariant)).toEqual(["noite", "dia"]);

    const chosen = await suggestions(`date=2026-12-25&celebration=${dayMass.id}`);
    expect(chosen.status).toBe(200);
    expect(chosen.body.celebration).toMatchObject({ reviewStatus: "pending_review" });
    expect((await suggestions("date=2026-12-25&celebration=nao-existe")).status).toBe(404);

    // O mesmo formulário da mesma celebração, na mesma data, não entra duas vezes.
    expect((await create(testCelebration({ date: "2026-12-25", celebrationKey: "natal-do-senhor", massVariant: "dia", scope: "universal" }))).status).toBe(409);
  });

  it("celebração diocesana não aparece no calendário nacional", async () => {
    await created(testCelebration({ date: "2026-11-22", scope: "diocesan", diocese: "diocese-teste", celebrationKey: "padroeira-teste", title: "[TESTE] Padroeira" }));
    const { body } = await byDate("2026-11-22");
    expect(body.celebrations.map((entry) => entry.celebrationId)).toEqual(["2026-11-22-cristo-rei"]);
  });

  it("busca por período, título, tempo e situação, paginada", async () => {
    expect((await search("from=2026-12-01&to=2026-12-31")).body.total).toBe(5);
    expect((await search("q=advento")).body.celebrations.map((entry) => entry.date)).toEqual(["2026-11-29", "2026-12-06", "2026-12-13", "2026-12-20"]);
    expect((await search("season=natal")).body.total).toBe(2);
    expect((await search("status=reviewed")).body.total).toBe(0);
    const firstPage = await search("pageSize=4");
    expect(firstPage.body).toMatchObject({ total: 9, totalPages: 3 });
    expect(firstPage.body.celebrations).toHaveLength(4);
    expect((await search("pageSize=4&page=3")).body.celebrations.map((entry) => entry.date)).toEqual(["2027-01-01"]);
    for (const query of ["from=2026-01-01&to=2027-06-01", "status=aprovada", "pageSize=51", "from=2026-02-30", "extra=1"]) {
      expect((await search(query)).status).toBe(400);
    }
  });
});

describe("E. recomendação", () => {
  function songInput(title: string): CatalogSongInput {
    return {
      song: { title, artist: "Grupo Fictício", originalKey: "C", contentType: "original", chordPro: `[C]Letra de ${title}` },
      rights: { basis: "original-work", evidence: "Teste", displayChordPro: true, shareChordPro: true },
    };
  }

  function liturgy(fields: Partial<SongClassificationInput>): SongClassificationInput {
    return {
      category: "liturgical",
      moments: ["comunhao"],
      seasons: [],
      celebrations: [],
      themes: [],
      scripture: [],
      avoidSeasons: [],
      suitabilityNotes: "",
      editorialRationale: "Teste",
      guidanceSource: "Fonte fictícia de teste",
      officialReference: "",
      ...fields,
    };
  }

  async function song(title: string, fields: Partial<SongClassificationInput> | null, publish = true): Promise<CatalogSong> {
    const createdSong = (await json<{ song: CatalogSong }>(await adminSongsRoute.POST(request(admin, "POST", "/x", songInput(title)), params({})))).song;
    let current = createdSong;
    if (publish) {
      current = (await json<{ song: CatalogSong }>(
        await adminPublishRoute.POST(request(admin, "POST", "/x", undefined, current.revision), params({ id: current.id })),
      )).song;
    }
    if (fields) {
      current = (await json<{ song: CatalogSong }>(
        await classificationRoute.PUT(request(admin, "PUT", "/x", { liturgy: liturgy(fields) }, current.revision), params({ id: current.id })),
      )).song;
    }
    return current;
  }

  it("celebração revisada e música classificada: sugestão definitiva e adequada", async () => {
    const record = await approved(await created());
    const classifiedSong = await song("Pão da Vida", { themes: ["eucaristia"], scripture: [{ book: "jo", chapter: 6 }] });

    // Classificação recém-salva ainda não foi conferida: o resultado é provisório.
    const pending = await suggestions(`date=${record.date}&moment=comunhao`);
    expect(pending.body.assurance).toBe("provisional");
    expect(pending.body.cautions).toEqual(["Há músicas sugeridas com classificação ainda não conferida por uma pessoa da equipe."]);

    const reviewed = await classificationReviewRoute.POST(
      request(admin, "POST", "/x", { action: "approve", humanReviewConfirmed: true, source: "Fonte fictícia de teste" }, classifiedSong.revision),
      params({ id: classifiedSong.id }),
    );
    expect(reviewed.status).toBe(200);

    const { body } = await suggestions(`date=${record.date}&moment=comunhao`);
    expect(body.assurance).toBe("definitive");
    expect(body.cautions).toEqual([]);
    const [suggestion] = body.moments[0].suggestions;
    expect(suggestion).toMatchObject({
      song: { title: "Pão da Vida" },
      matches: { readings: ["gospel"], themes: ["eucaristia"] },
    });
  });

  it("em revisão: as mesmas sugestões, provisórias; despublicada e sem classificação ficam de fora", async () => {
    await created();
    await song("Pão da Vida", {});
    await song("Rascunho", {}, false);
    await song("Sem Classificação", null);
    const gone = await song("Despublicada", {});
    await adminUnpublishRoute.POST(request(admin, "POST", "/x", undefined, gone.revision), params({ id: gone.id }));

    const { body } = await suggestions("date=2031-03-02&moment=comunhao");
    expect(body.assurance).toBe("provisional");
    expect(body.cautions[0]).toContain("não foram aprovados por uma revisão humana");
    expect(titles(body.moments, "comunhao")).toEqual(["Pão da Vida"]);
  });

  it("salmo não conferido: nenhuma música sugerida no lugar", async () => {
    await importEditorialCelebrations();
    await song("Salmo Fictício", { moments: ["salmo-responsorial"], scripture: [{ book: "sl", chapter: 89 }] });

    const { body } = await suggestions("date=2026-12-20");
    expect(body.cautions).toContain("Ainda não conferido: salmo responsorial. Nada é sugerido no lugar.");
    expect(body.moments.find((entry) => entry.moment === "salmo-responsorial")?.total).toBe(0);
  });

  it("leitura em divergência não embasa sugestão", async () => {
    const record = await created();
    await song("Salmo do Pastor", { moments: ["salmo-responsorial"], scripture: [{ book: "sl", chapter: 23 }] });
    expect(titles((await suggestions("date=2031-03-02")).body.moments, "salmo-responsorial")).toEqual(["Salmo do Pastor"]);

    await review(record, { action: "dispute", fields: ["psalm"], note: "Salmo a conferir." });
    const { body } = await suggestions("date=2031-03-02");
    expect(titles(body.moments, "salmo-responsorial")).toEqual([]);
    expect(body.cautions.join(" ")).toContain("Há divergência em: salmo responsorial");
  });

  it("a qualidade do catálogo aponta o que não recebe sugestões, sem alterar nada", async () => {
    const unclassified = await song("Sem Classificação", null);
    await song("Devocional", { category: "devotional", moments: [] });
    await song("Bem Classificada", {});
    const before = await json<unknown>(await adminSongsRoute.GET(request(admin, "GET"), params({})));

    const report = await json<{ entries: { title: string; readiness: string; issues: { code: string }[] }[] }>(
      await qualityRoute.GET(request(admin, "GET"), params({})),
    );
    // Toda classificação começa não conferida; a conferência é sempre de uma pessoa.
    expect(report.entries.map((entry) => [entry.title, entry.readiness, entry.issues.map((issue) => issue.code)])).toEqual([
      ["Bem Classificada", "unreviewed", ["unreviewed"]],
      ["Devocional", "not-for-mass", ["no-moments", "unreviewed", "not-recommendable"]],
      ["Sem Classificação", "unclassified", ["unclassified", "not-recommendable"]],
    ]);
    expect(await json<unknown>(await adminSongsRoute.GET(request(admin, "GET"), params({})))).toEqual(before);
    expect(unclassified.liturgy).toBeNull();
  });
});

describe("F. regressão: repertório da missa e compartilhamento", () => {
  it("cria, vincula, adiciona, ajusta o tom, compartilha, abre sem login e revoga", async () => {
    const record = await approved(await created());
    const catalogSong = (await json<{ song: CatalogSong }>(
      await adminSongsRoute.POST(
        request(admin, "POST", "/x", {
          song: { title: "Pão da Vida", artist: "Grupo", originalKey: "C", contentType: "original", chordPro: "[C]Letra" },
          rights: { basis: "original-work", evidence: "Teste", displayChordPro: true, shareChordPro: true },
        }),
        params({}),
      ),
    )).song;
    await adminPublishRoute.POST(request(admin, "POST", "/x", undefined, catalogSong.revision), params({ id: catalogSong.id }));

    const mass = { date: record.date, celebrationId: record.id, title: record.title, celebrationRevision: record.revision };
    const createdRepertoire = await repertoiresRoute.POST(request(userA, "POST", "/x", { name: "Missa de teste", description: "", mass }), params({}));
    expect(createdRepertoire.status).toBe(201);
    let repertoire = (await json<{ repertoire: Repertoire }>(createdRepertoire)).repertoire;
    expect(repertoire.mass).toEqual(mass);

    repertoire = (await json<{ repertoire: Repertoire }>(
      await itemsRoute.POST(request(userA, "POST", "/x", { songId: catalogSong.id, source: "catalog", moment: "comunhao" }, repertoire.revision), params({ id: repertoire.id })),
    )).repertoire;
    repertoire = (await json<{ repertoire: Repertoire }>(
      await itemRoute.PATCH(request(userA, "PATCH", "/x", { transposeSemitones: 2, notes: "NOTA PRIVADA" }, repertoire.revision), params({ id: repertoire.id, itemId: repertoire.items[0].id })),
    )).repertoire;

    // Revisar a celebração depois não muda nada no repertório.
    const before = await RepertoireModel.findOne({ id: repertoire.id }).lean();
    expect((await review(record, { action: "reopen", note: "Revisão nova." })).status).toBe(200);
    expect(await RepertoireModel.findOne({ id: repertoire.id }).lean()).toEqual(before);
    expect((await publicById(record.id)).body.celebration.revision).toBeGreaterThan(mass.celebrationRevision);

    const library = createLibraryService(userA.id);
    const { contentHash } = await library.shares.preview(repertoire.id, { authorizations: [] });
    const share = await library.shares.create(repertoire.id, { authorizations: [], expectedHash: contentHash });
    const token = share.path!.replace("/s/", "");
    const opened = await publicShareRoute.GET(new Request(`${ORIGIN}/x`), params({ token }));
    const text = await opened.text();
    const snapshot = (JSON.parse(text) as { share: PublicShareSnapshot }).share;
    expect(snapshot.mass).toEqual({ title: "[TESTE] Celebração fictícia" });
    expect(snapshot.items[0]).toMatchObject({ moment: "comunhao", transposeSemitones: 2, content: { kind: "chordpro" } });
    expect(text).not.toContain("NOTA PRIVADA");
    expect(text).not.toContain(record.id);

    await library.shares.revoke(repertoire.id, share.id);
    expect((await publicShareRoute.GET(new Request(`${ORIGIN}/x`), params({ token }))).status).toBe(404);
  });
});
