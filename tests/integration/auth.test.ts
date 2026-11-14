import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { getAuth, resetAuthForTests } from "@/server/auth/auth";
import { getSessionFromHeaders } from "@/server/auth/session";
import { getMongoClient } from "@/server/database/mongodb-client";

import { authRequest, createTestUser, dropTestDatabase, getCookieHeader } from "./helpers";

afterEach(() => {
  vi.unstubAllEnvs();
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
