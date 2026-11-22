// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isSignUpEnabled, requiresEmailVerification } from "./sign-up-policy";

const publicConfig = {
  NODE_ENV: "production",
  AUTH_ALLOW_SIGNUP: "true",
  RESEND_API_KEY: "chave-apenas-de-teste",
  AUTH_EMAIL_FROM: "contas@exemplo.test",
  BETTER_AUTH_URL: "https://repertorio.example",
};

describe("isSignUpEnabled", () => {
  it.each(["development", "test"])("permite em %s com autorização explícita", (NODE_ENV) => {
    expect(isSignUpEnabled({ NODE_ENV, AUTH_ALLOW_DEV_SIGNUP: "true" })).toBe(true);
  });

  it.each([undefined, "false", "1", ""])("recusa em desenvolvimento com flag %j", (flag) => {
    expect(isSignUpEnabled({ NODE_ENV: "development", AUTH_ALLOW_DEV_SIGNUP: flag })).toBe(false);
  });

  it("a flag de desenvolvimento nunca abre produção", () => {
    expect(isSignUpEnabled({ NODE_ENV: "production", AUTH_ALLOW_DEV_SIGNUP: "true" })).toBe(false);
  });

  it("fechar o cadastro público não desativa a confirmação de e-mail em produção", () => {
    expect(requiresEmailVerification({ ...publicConfig, AUTH_ALLOW_SIGNUP: "false" })).toBe(true);
  });

  it("abre produção com autorização, envio de e-mail e HTTPS", () => {
    expect(isSignUpEnabled(publicConfig)).toBe(true);
    expect(requiresEmailVerification(publicConfig)).toBe(true);
  });

  it.each([
    { AUTH_ALLOW_SIGNUP: "false" },
    { RESEND_API_KEY: undefined },
    { RESEND_API_KEY: " " },
    { AUTH_EMAIL_FROM: "inválido" },
    { BETTER_AUTH_URL: "http://repertorio.example" },
  ])("mantém produção fechada com configuração incompleta: %j", (override) => {
    expect(isSignUpEnabled({ ...publicConfig, ...override })).toBe(false);
  });

  it("não usa a exceção de desenvolvimento se o cadastro público exige confirmação", () => {
    const config = { NODE_ENV: "test", AUTH_ALLOW_DEV_SIGNUP: "true", AUTH_ALLOW_SIGNUP: "true" };
    expect(isSignUpEnabled(config)).toBe(false);
    expect(requiresEmailVerification(config)).toBe(true);
  });

  it.each([undefined, "", "staging"])("recusa em ambiente desconhecido %j", (nodeEnv) => {
    expect(isSignUpEnabled({ ...publicConfig, NODE_ENV: nodeEnv })).toBe(false);
  });
});
