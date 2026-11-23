import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAuth, resetAuthForTests } from "@/server/auth/auth";
import { getSessionFromHeaders } from "@/server/auth/session";
import { getMongoClient } from "@/server/database/mongodb-client";

import { authRequest, createTestUser, dropTestDatabase, getCookieHeader } from "./helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetAuthForTests();
});
afterAll(dropTestDatabase);

function database() {
  return getMongoClient().db(process.env.MONGODB_DB_NAME);
}

function uniqueEmail(): string {
  return `pessoa-${crypto.randomUUID()}@exemplo.test`;
}

describe("cadastro", () => {
  it("cria o usuário e já abre a sessão", async () => {
    const user = await createTestUser("ana");

    await expect(getSessionFromHeaders(new Headers({ cookie: user.cookie }))).resolves.toMatchObject({
      user: { id: user.id, email: user.email },
    });
  });

  it("não devolve nem guarda a senha em texto puro", async () => {
    const email = uniqueEmail();
    const password = "senha-bem-secreta-987";
    const response = await authRequest("sign-up/email", { name: "Bia", email, password });
    const body = await response.text();

    expect(body).not.toContain(password);
    const user = await database().collection("user").findOne({ email });
    const account = await database().collection("account").findOne({ userId: user?._id });
    expect(typeof account?.password).toBe("string");
    expect(account?.password).not.toContain(password);
  });

  it("usa cookies HttpOnly e SameSite=Lax", async () => {
    const response = await authRequest("sign-up/email", {
      name: "Cid",
      email: uniqueEmail(),
      password: "senha-de-teste-123",
    });
    const cookie = response.headers.getSetCookie()[0];

    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it.each([
    ["senha curta", { name: "D", email: uniqueEmail(), password: "curta" }],
    ["e-mail inválido", { name: "E", email: "nao-e-email", password: "senha-de-teste-123" }],
    ["sem nome", { email: uniqueEmail(), password: "senha-de-teste-123" }],
  ])("rejeita cadastro com %s", async (_name, body) => {
    const response = await authRequest("sign-up/email", body);

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(getCookieHeader(response)).toBe("");
  });

  it("não cria uma segunda conta com o mesmo e-mail", async () => {
    const { email } = await createTestUser("fred");

    const response = await authRequest("sign-up/email", { name: "Outro", email, password: "outra-senha-123" });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await database().collection("user").countDocuments({ email })).toBe(1);
  });
});

describe("política de cadastro", () => {
  it("fica fechado sem a autorização explícita", async () => {
    vi.stubEnv("AUTH_ALLOW_DEV_SIGNUP", "false");
    resetAuthForTests();

    const response = await authRequest("sign-up/email", {
      name: "G",
      email: uniqueEmail(),
      password: "senha-de-teste-123",
    });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("EMAIL_PASSWORD_SIGN_UP_DISABLED");
  });

  it("a variável de desenvolvimento não abre o cadastro em produção", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_ALLOW_DEV_SIGNUP", "true");
    resetAuthForTests();
    const email = uniqueEmail();

    const response = await authRequest("sign-up/email", { name: "H", email, password: "senha-de-teste-123" });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("EMAIL_PASSWORD_SIGN_UP_DISABLED");
    expect(await database().collection("user").countDocuments({ email })).toBe(0);
  });
});

describe("cadastro público em produção (somente banco local e Resend simulado)", () => {
  const origin = "https://repertorio.example";
  const password = "senha-de-teste-123";
  let ipIndex = 1;
  let ip: string;
  let delivery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("AUTH_ALLOW_SIGNUP", "true");
    vi.stubEnv("RESEND_API_KEY", "chave-apenas-de-teste");
    vi.stubEnv("AUTH_EMAIL_FROM", "contas@exemplo.test");
    vi.stubEnv("BETTER_AUTH_URL", origin);
    resetAuthForTests();
    ip = `198.51.100.${ipIndex++}`;
    delivery = vi.fn().mockImplementation(async () => new Response('{"id":"envio-simulado"}'));
    vi.stubGlobal("fetch", delivery);
  });

  function request(path: string, body: unknown, cookie?: string): Promise<Response> {
    return getAuth().handler(new Request(`${origin}/api/auth/${path}`, {
      method: "POST",
      headers: {
        origin, "content-type": "application/json", "x-forwarded-for": ip,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }));
  }

  function verificationURL(): string {
    const body = JSON.parse(delivery.mock.calls.at(-1)![1].body);
    return body.text.match(/https:\/\/[^\s]+/)[0];
  }

  it("exige confirmação, redireciona, permite login e invalida a sessão no logout", async () => {
    const email = uniqueEmail();
    const created = await request("sign-up/email", {
      name: "Visitante", email, password, role: "admin", emailVerified: true,
      callbackURL: "/entrar?email=confirmado",
    });
    expect(created.status).toBe(200);
    expect((await created.json()).token).toBeNull();
    expect(getCookieHeader(created)).toBe("");
    expect(delivery).toHaveBeenCalledTimes(1);
    expect(await database().collection("user").findOne({ email })).toMatchObject({ emailVerified: false });

    const denied = await request("sign-in/email", { email, password });
    expect(denied.status).toBe(403);
    expect((await denied.json()).code).toBe("EMAIL_NOT_VERIFIED");
    expect(getCookieHeader(denied)).toBe("");

    const verified = await getAuth().handler(new Request(verificationURL()));
    expect(verified.status).toBe(302);
    expect(verified.headers.get("location")).toBe("/entrar?email=confirmado");
    expect(await database().collection("user").findOne({ email })).toMatchObject({ emailVerified: true });

    const login = await request("sign-in/email", { email, password });
    expect(login.status).toBe(200);
    const cookie = getCookieHeader(login);
    expect(cookie).not.toBe("");
    expect(login.headers.getSetCookie().join(";")).toMatch(/Secure/i);
    expect(login.headers.getSetCookie().join(";")).toMatch(/HttpOnly/i);
    expect(login.headers.getSetCookie().join(";")).toMatch(/SameSite=Lax/i);
    const session = await getSessionFromHeaders(new Headers({ cookie }));
    expect(session?.user.email).toBe(email);
    const { isCatalogAdmin } = await import("@/server/catalog/catalog-service");
    expect(await isCatalogAdmin(session!.user.id)).toBe(false);

    const logout = await request("sign-out", {}, cookie);
    expect(logout.status).toBe(200);
    await expect(getSessionFromHeaders(new Headers({ cookie }))).resolves.toBeNull();
  });

  it("não duplica contas nem revela se o e-mail já existe", async () => {
    const email = uniqueEmail();
    const first = await request("sign-up/email", { name: "Primeira", email, password });
    const duplicate = await request("sign-up/email", { name: "Outra", email, password });
    expect(first.status).toBe(200);
    expect(duplicate.status).toBe(200);
    expect((await duplicate.json()).token).toBeNull();
    expect(getCookieHeader(duplicate)).toBe("");
    expect(await database().collection("user").countDocuments({ email })).toBe(1);
    expect(delivery).toHaveBeenCalledTimes(1);
  });

  it("fechar novos cadastros não permite login de uma conta sem confirmação", async () => {
    const email = uniqueEmail();
    await request("sign-up/email", { name: "Visitante", email, password });
    vi.stubEnv("AUTH_ALLOW_SIGNUP", "false");
    resetAuthForTests();

    const response = await request("sign-in/email", { email, password });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("EMAIL_NOT_VERIFIED");
    expect(getCookieHeader(response)).toBe("");
  });

  it("mantém o cadastro fechado sem provedor, mesmo com a flag de desenvolvimento", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    resetAuthForTests();
    const email = uniqueEmail();
    const response = await request("sign-up/email", { name: "Visitante", email, password });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("EMAIL_PASSWORD_SIGN_UP_DISABLED");
    expect(await database().collection("user").countDocuments({ email })).toBe(0);
    expect(delivery).not.toHaveBeenCalled();
  });

  it("recusa token forjado e redirecionamento para outra origem", async () => {
    const invalid = await getAuth().handler(new Request(`${origin}/api/auth/verify-email?token=forjado&callbackURL=/entrar?email=confirmado`));
    expect(invalid.status).toBe(302);
    expect(invalid.headers.get("location")).toContain("error=INVALID_TOKEN");

    const email = uniqueEmail();
    const response = await request("sign-up/email", {
      name: "Visitante", email, password, callbackURL: "https://site-malicioso.example",
    });
    expect(response.status).toBe(403);
    expect(await database().collection("user").countDocuments({ email })).toBe(0);
  });

  it("recusa um link expirado sem confirmar a conta", async () => {
    const email = uniqueEmail();
    await request("sign-up/email", { name: "Visitante", email, password });
    const url = verificationURL();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 3_601_000);

    const response = await getAuth().handler(new Request(url));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("error=TOKEN_EXPIRED");
    expect(getCookieHeader(response)).toBe("");
    expect(await database().collection("user").findOne({ email })).toMatchObject({ emailVerified: false });
  });

  it("limita cadastros e mantém o contador entre instâncias do Better Auth", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await request("sign-up/email", { name: "Visitante", email: "inválido", password });
      expect(response.status).not.toBe(429);
    }
    resetAuthForTests();
    const response = await request("sign-up/email", { name: "Visitante", email: uniqueEmail(), password });
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("x-retry-after"))).toBeGreaterThan(0);
    expect(delivery).not.toHaveBeenCalled();
  });

  it("permite reenviar confirmação e limita o abuso de reenvios", async () => {
    const email = uniqueEmail();
    await request("sign-up/email", { name: "Visitante", email, password });
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await request("send-verification-email", { email, callbackURL: "/entrar?email=confirmado" });
      expect(response.status).toBe(200);
    }
    expect(delivery).toHaveBeenCalledTimes(4);
    const blocked = await request("send-verification-email", { email });
    expect(blocked.status).toBe(429);
  });
});

describe("login", () => {
  it("entra com credenciais válidas", async () => {
    const { email, password, id } = await createTestUser("iris");

    const response = await authRequest("sign-in/email", { email, password });

    expect(response.status).toBe(200);
    await expect(
      getSessionFromHeaders(new Headers({ cookie: getCookieHeader(response) })),
    ).resolves.toMatchObject({ user: { id } });
  });

  it("recusa senha errada e e-mail inexistente com a mesma resposta", async () => {
    const { email } = await createTestUser("joao");

    const wrong = await authRequest("sign-in/email", { email, password: "senha-errada-123" });
    const unknown = await authRequest("sign-in/email", { email: uniqueEmail(), password: "senha-errada-123" });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(getCookieHeader(wrong)).toBe("");
    expect((await wrong.json()).code).toBe((await unknown.json()).code);
  });

  it("recusa requisições de origem não confiável", async () => {
    const { email, password } = await createTestUser("kim");

    const response = await getAuth().handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://site-malicioso.example",
          cookie: "a=b",
        },
        body: JSON.stringify({ email, password }),
      }),
    );

    expect(response.status).toBe(403);
  });
});

describe("sessão", () => {
  it("mantém a exclusão automática desabilitada sem apagar a conta ou a sessão", async () => {
    const { id, email, cookie } = await createTestUser("exclusao-manual");

    const response = await authRequest("delete-user", {}, cookie);

    expect(response.status).toBe(404);
    expect(await database().collection("user").countDocuments({ email })).toBe(1);
    await expect(getSessionFromHeaders(new Headers({ cookie }))).resolves.toMatchObject({ user: { id } });
  });

  it("é ausente sem cookie", async () => {
    await expect(getSessionFromHeaders(new Headers())).resolves.toBeNull();
  });

  it("é ausente com cookie forjado", async () => {
    await expect(
      getSessionFromHeaders(new Headers({ cookie: "better-auth.session_token=forjado.assinatura" })),
    ).resolves.toBeNull();
  });

  it("logout invalida a sessão no servidor", async () => {
    const { cookie } = await createTestUser("lia");

    const response = await authRequest("sign-out", {}, cookie);

    expect(response.status).toBe(200);
    await expect(getSessionFromHeaders(new Headers({ cookie }))).resolves.toBeNull();
  });
});
