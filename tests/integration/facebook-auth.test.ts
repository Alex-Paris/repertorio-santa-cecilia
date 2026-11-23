import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAuth, resetAuthForTests } from "@/server/auth/auth";
import { getSessionFromHeaders } from "@/server/auth/session";
import { getMongoClient } from "@/server/database/mongodb-client";

import { dropTestDatabase, getCookieHeader } from "./helpers";

const origin = "https://repertorio.example";
const appId = "123456789";
const accessToken = "token-facebook-simulado";
let ipIndex = 1;
let ip: string;
let tokenAppId: string;
let profile: { id: string; name: string; email?: string; email_verified: boolean; picture: { data: { url: string } }; role?: string };
let emailURLs: string[];
let externalFetch: ReturnType<typeof vi.fn>;

function database() {
  return getMongoClient().db(process.env.MONGODB_DB_NAME);
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("BETTER_AUTH_URL", origin);
  vi.stubEnv("AUTH_ALLOW_SIGNUP", "true");
  vi.stubEnv("RESEND_API_KEY", "chave-resend-de-teste");
  vi.stubEnv("AUTH_EMAIL_FROM", "contas@exemplo.test");
  vi.stubEnv("FACEBOOK_CLIENT_ID", appId);
  vi.stubEnv("FACEBOOK_CLIENT_SECRET", "segredo-facebook-de-teste");
  resetAuthForTests();
  ip = `198.51.100.${ipIndex++}`;
  tokenAppId = appId;
  profile = {
    id: crypto.randomUUID(), name: "Pessoa do Facebook",
    email: `facebook-${crypto.randomUUID()}@exemplo.test`, email_verified: false,
    picture: { data: { url: "https://example.com/avatar.png" } },
  };
  emailURLs = [];
  externalFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "graph.facebook.com") {
      if (url.pathname.endsWith("/oauth/access_token")) {
        return Response.json({ access_token: accessToken, token_type: "bearer", expires_in: 3600 });
      }
      if (url.pathname === "/debug_token") {
        return Response.json({ data: { is_valid: true, app_id: tokenAppId, user_id: profile.id } });
      }
      if (url.pathname === "/me") return Response.json(profile);
    }
    if (url.href === "https://api.resend.com/emails") {
      const body = JSON.parse(String(init?.body));
      emailURLs.push(body.text.match(/https:\/\/[^\s]+/)[0]);
      return Response.json({ id: "envio-simulado" });
    }
    throw new Error("Requisição externa não simulada.");
  });
  vi.stubGlobal("fetch", externalFetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetAuthForTests();
});
afterAll(dropTestDatabase);

function request(path: string, body: unknown, cookie?: string) {
  return getAuth().handler(new Request(`${origin}/api/auth/${path}`, {
    method: "POST",
    headers: {
      origin, "content-type": "application/json", "x-forwarded-for": ip,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  }));
}

async function start() {
  const response = await request("sign-in/social", {
    provider: "facebook", callbackURL: "/", errorCallbackURL: "/entrar?social=facebook",
  });
  expect(response.status).toBe(200);
  const body = await response.json();
  return { response, authorization: new URL(body.url), cookie: getCookieHeader(response) };
}

async function finish(flow: Awaited<ReturnType<typeof start>>, extra?: Record<string, string>) {
  const url = new URL(`${origin}/api/auth/callback/facebook`);
  url.searchParams.set("state", flow.authorization.searchParams.get("state")!);
  url.searchParams.set("code", "codigo-simulado");
  for (const [key, value] of Object.entries(extra ?? {})) url.searchParams.set(key, value);
  return getAuth().handler(new Request(url, { headers: { cookie: flow.cookie, "x-forwarded-for": ip } }));
}

describe("Facebook OAuth com Meta e Resend simulados e banco local", () => {
  it("inicia o fluxo com state, callback e permissões mínimas, sem expor o segredo", async () => {
    const flow = await start();
    expect(flow.authorization.hostname).toBe("www.facebook.com");
    expect(flow.authorization.searchParams.get("client_id")).toBe(appId);
    expect(flow.authorization.searchParams.get("redirect_uri")).toBe(`${origin}/api/auth/callback/facebook`);
    expect(flow.authorization.searchParams.get("state")).toBeTruthy();
    expect(flow.authorization.searchParams.get("scope")?.split(/[ ,]+/).sort()).toEqual(["email", "public_profile"]);
    expect(flow.authorization.href).not.toContain("segredo-facebook-de-teste");
    expect(flow.cookie).not.toBe("");
    expect(externalFetch).not.toHaveBeenCalled();
  });

  it("cria uma conta comum, exige confirmação e permite voltar pelo Facebook após confirmar", async () => {
    profile.role = "admin";
    const first = await finish(await start());
    expect(first.status).toBe(302);
    expect(first.headers.get("location")).toContain("error=email_not_verified");
    expect(first.headers.get("location")).toContain("social=facebook");
    expect(getCookieHeader(first)).not.toMatch(/session_token=[^;]/);
    const user = await database().collection("user").findOne({ email: profile.email });
    expect(user).toMatchObject({ emailVerified: false });
    expect(await database().collection("catalog_admins").countDocuments({ userId: String(user!._id) })).toBe(0);
    expect(emailURLs).toHaveLength(1);
    const account = await database().collection("account").findOne({ providerId: "facebook", accountId: profile.id });
    expect(account?.accessToken).toBeTruthy();
    expect(account?.accessToken).not.toContain(accessToken);

    const verification = await getAuth().handler(new Request(emailURLs[0]));
    expect(verification.status).toBe(302);
    expect(verification.headers.get("location")).toBe("/entrar?email=confirmado");

    const login = await finish(await start());
    expect(login.status).toBe(302);
    expect(login.headers.get("location")).toBe("/");
    const cookie = getCookieHeader(login);
    expect(cookie).toMatch(/session_token=/);
    expect(login.headers.getSetCookie().join(";")).toMatch(/HttpOnly/i);
    expect(login.headers.getSetCookie().join(";")).toMatch(/Secure/i);
    expect(login.headers.getSetCookie().join(";")).toMatch(/SameSite=Lax/i);
    const session = await getSessionFromHeaders(new Headers({ cookie }));
    expect(session?.user.email).toBe(profile.email);

    const logout = await request("sign-out", {}, cookie);
    expect(logout.status).toBe(200);
    await expect(getSessionFromHeaders(new Headers({ cookie }))).resolves.toBeNull();
  });

  it("aceita o e-mail já verificado pelo provedor sem exigir nova confirmação", async () => {
    profile.email_verified = true;
    const response = await finish(await start());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    expect(getCookieHeader(response)).toMatch(/session_token=/);
    expect(await database().collection("user").findOne({ email: profile.email })).toMatchObject({ emailVerified: true });
  });

  it("não associa automaticamente o Facebook a uma conta administrativa com o mesmo e-mail", async () => {
    const existing = await request("sign-up/email", {
      name: "Administradora", email: profile.email, password: "senha-de-teste-123",
    });
    expect(existing.status).toBe(200);
    await getAuth().handler(new Request(emailURLs[0]));
    const user = await database().collection("user").findOne({ email: profile.email });
    await database().collection("catalog_admins").insertOne({ userId: String(user!._id), grantedAt: new Date(), grantedBy: "teste" });
    profile.email_verified = true;

    const response = await finish(await start());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("error=account_not_linked");
    expect(getCookieHeader(response)).not.toMatch(/session_token=[^;]/);
    expect(await database().collection("user").countDocuments({ email: profile.email })).toBe(1);
    expect(await database().collection("account").countDocuments({ providerId: "facebook", accountId: profile.id })).toBe(0);
    expect(await database().collection("catalog_admins").countDocuments({ userId: String(user!._id) })).toBe(1);
  });

  it("respeita o fechamento de novos cadastros", async () => {
    vi.stubEnv("AUTH_ALLOW_SIGNUP", "false");
    resetAuthForTests();
    const response = await finish(await start());
    expect(response.headers.get("location")).toContain("error=signup_disabled");
    expect(await database().collection("user").countDocuments({ email: profile.email })).toBe(0);
  });

  it("recusa uma conta do Facebook sem e-mail, sem inventar um endereço", async () => {
    delete profile.email;
    const usersBefore = await database().collection("user").countDocuments({});
    const response = await finish(await start());
    expect(response.headers.get("location")).toContain("error=email_not_found");
    expect(await database().collection("user").countDocuments({})).toBe(usersBefore);
  });

  it("trata o cancelamento na Meta sem criar conta ou sessão", async () => {
    const response = await finish(await start(), { error: "access_denied" });
    expect(response.headers.get("location")).toContain("error=access_denied");
    expect(await database().collection("user").countDocuments({ email: profile.email })).toBe(0);
    expect(externalFetch).not.toHaveBeenCalled();
  });

  it("recusa state forjado sem consultar a Meta", async () => {
    const response = await finish(await start(), { state: "forjado" });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("error=");
    expect(externalFetch).not.toHaveBeenCalled();
    expect(await database().collection("user").countDocuments({ email: profile.email })).toBe(0);
  });

  it("recusa um token emitido para outro aplicativo Facebook", async () => {
    tokenAppId = "999999999";
    const response = await finish(await start());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("error=unable_to_get_user_info");
    expect(await database().collection("user").countDocuments({ email: profile.email })).toBe(0);
  });

  it("recusa retorno para origem externa", async () => {
    const response = await request("sign-in/social", {
      provider: "facebook", callbackURL: "https://site-malicioso.example",
    });
    expect(response.status).toBe(403);
    expect(externalFetch).not.toHaveBeenCalled();
  });
});
