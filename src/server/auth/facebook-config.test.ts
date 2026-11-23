// @vitest-environment node
import { describe, expect, it } from "vitest";

import { getFacebookConfig } from "./facebook-config";

const configured = {
  NODE_ENV: "production",
  FACEBOOK_CLIENT_ID: "123456789",
  FACEBOOK_CLIENT_SECRET: "segredo-apenas-de-teste",
  BETTER_AUTH_URL: "https://repertorio.example",
  AUTH_ALLOW_SIGNUP: "true",
  RESEND_API_KEY: "chave-apenas-de-teste",
  AUTH_EMAIL_FROM: "contas@exemplo.test",
};

describe("configuração do Facebook", () => {
  it.each([
    {},
    { FACEBOOK_CLIENT_ID: "123456789" },
    { FACEBOOK_CLIENT_SECRET: "segredo" },
    { ...configured, FACEBOOK_CLIENT_ID: "inválido" },
    { ...configured, FACEBOOK_CLIENT_SECRET: " " },
    { ...configured, BETTER_AUTH_URL: "http://repertorio.example" },
  ])("não oferece o Facebook com configuração ausente ou inválida: %j", (source) => {
    expect(getFacebookConfig(source)).toBeNull();
  });

  it("usa credenciais privadas e apenas as permissões básicas", () => {
    expect(getFacebookConfig(configured)).toEqual({
      clientId: "123456789", clientSecret: "segredo-apenas-de-teste",
      scope: ["email", "public_profile"], disableDefaultScope: true,
      disableSignUp: false, requireEmailVerification: true,
    });
  });

  it("permite entrar em contas existentes mantendo novos cadastros fechados", () => {
    expect(getFacebookConfig({ ...configured, AUTH_ALLOW_SIGNUP: "false" })).toMatchObject({
      disableSignUp: true, requireEmailVerification: true,
    });
  });

  it("a falta do Resend não abre cadastro pelo Facebook", () => {
    expect(getFacebookConfig({ ...configured, RESEND_API_KEY: "" })).toMatchObject({
      disableSignUp: true, requireEmailVerification: true,
    });
  });

  it("aceita HTTP no desenvolvimento e preserva a política local", () => {
    expect(getFacebookConfig({
      ...configured, NODE_ENV: "development", BETTER_AUTH_URL: "http://localhost:3000",
      AUTH_ALLOW_SIGNUP: "false", AUTH_ALLOW_DEV_SIGNUP: "true",
    })).toMatchObject({ disableSignUp: false, requireEmailVerification: false });
  });
});
