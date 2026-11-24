import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as prefillRoute from "@/app/api/v1/admin/liturgy/prefill/route";
import * as celebrationsRoute from "@/app/api/v1/admin/liturgy/celebrations/route";
import { upstreamLiturgy } from "@/test/liturgy-prefill-fixtures";
import { LiturgicalCelebrationModel } from "@/server/database/models/liturgical-celebration-model";
import { CelebrationHistoryModel } from "@/server/database/models/liturgical-celebration-history-model";
import { resetRateLimitsForTests } from "@/server/http/rate-limit";

import { clearDatabase, createTestUser, dropTestDatabase, ORIGIN, runScript, type TestUser } from "./helpers";

let admin: TestUser;
let visitor: TestUser;
let fetchMock: ReturnType<typeof vi.fn>;
const context = { params: Promise.resolve({}) };

function request(user: TestUser | null, query = "date=2027-01-10", expectedId?: string): Request {
  return new Request(`${ORIGIN}/api/v1/admin/liturgy/prefill?${query}`, { headers: {
    ...(user ? { cookie: user.cookie, "x-repertorio-expected-user": expectedId ?? user.id } : {}),
  } });
}

beforeEach(async () => {
  resetRateLimitsForTests();
  await clearDatabase();
  admin = await createTestUser("admin-prefill");
  visitor = await createTestUser("comum-prefill");
  await runScript("catalog-admin.mjs", "grant", "--email", admin.email);
  fetchMock = vi.fn().mockImplementation(async () => Response.json(upstreamLiturgy()));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
afterAll(dropTestDatabase);

describe("consulta da liturgia na administração", () => {
  it("exige sessão, papel administrativo e a identidade esperada antes de acessar a fonte", async () => {
    expect((await prefillRoute.GET(request(null), context)).status).toBe(401);
    expect((await prefillRoute.GET(request(visitor), context)).status).toBe(403);
    expect((await prefillRoute.GET(request(admin, "date=2027-01-10", visitor.id), context)).status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("consulta sem gravar e salva pela rota existente, em revisão, com histórico e proteção de duplicatas", async () => {
    const response = await prefillRoute.GET(request(admin), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const preview = await response.json();
    expect(await LiturgicalCelebrationModel.countDocuments({})).toBe(0);
    expect(JSON.stringify(preview)).not.toMatch(/texto-que|oracao-que|refrao-que|antifona-nao/);
    const createRequest = () => new Request(`${ORIGIN}/api/v1/admin/liturgy/celebrations`, {
      method: "POST", headers: { cookie: admin.cookie, origin: ORIGIN, "content-type": "application/json", "x-repertorio-expected-user": admin.id },
      body: JSON.stringify({ celebration: preview.draft }),
    });
    const created = await celebrationsRoute.POST(createRequest(), context);
    expect(created.status).toBe(201);
    const body = await created.json();
    expect(body.celebration).toMatchObject({ date: "2027-01-10", rank: "festa", reviewStatus: "pending_review", approval: null, revision: 1 });
    expect(await CelebrationHistoryModel.countDocuments({ celebrationId: body.celebration.id, actor: admin.id, action: "create" })).toBe(1);
    expect((await celebrationsRoute.POST(createRequest(), context)).status).toBe(409);
    expect(await LiturgicalCelebrationModel.countDocuments({})).toBe(1);
  });
  it.each(["date=2027-02-29", "date=2027-01-10&date=2027-01-11", "date=2027-01-10&url=http://localhost", ""])("recusa consulta inválida: %s", async (query) => {
    expect((await prefillRoute.GET(request(admin, query), context)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("distingue data sem dados de fonte indisponível", async () => {
    fetchMock.mockImplementationOnce(async () => Response.json({ erro: "ausente" }, { status: 404 }));
    expect((await prefillRoute.GET(request(admin), context)).status).toBe(404);
    fetchMock.mockImplementationOnce(async () => Response.json({ detalhe: "conteudo-interno" }, { status: 500 }));
    const response = await prefillRoute.GET(request(admin), context);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("conteudo-interno");
  });
  it("limita consultas da administração antes de acessar novamente a fonte", async () => {
    for (let i = 0; i < 12; i++) expect((await prefillRoute.GET(request(admin), context)).status).toBe(200);
    expect((await prefillRoute.GET(request(admin), context)).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });
});
