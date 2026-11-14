// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseServerEnv, ServerConfigurationError } from "./env";

const valid = {
  MONGODB_URI: "mongodb://usuario:senha@localhost:27017/?authSource=admin",
  MONGODB_DB_NAME: "repertorio_dev",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("parseServerEnv", () => {
  it("aceita uma configuração válida, inclusive Atlas", () => {
    expect(parseServerEnv(valid).MONGODB_DB_NAME).toBe("repertorio_dev");
    expect(parseServerEnv({ ...valid, MONGODB_URI: "mongodb+srv://a:b@c.mongodb.net/" })).toBeDefined();
  });

  it("informa as variáveis ausentes pelo nome", () => {
    expect(() => parseServerEnv({})).toThrowError(
      /MONGODB_URI, MONGODB_DB_NAME, BETTER_AUTH_SECRET, BETTER_AUTH_URL/,
    );
  });

  it("nunca coloca o valor de uma variável na mensagem", () => {
    const secret = "curto-demais";
    const uri = "postgres://usuario:senha-secreta@host";

    try {
      parseServerEnv({ ...valid, BETTER_AUTH_SECRET: secret, MONGODB_URI: uri });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ServerConfigurationError);
      expect((error as Error).message).not.toContain(secret);
      expect((error as Error).message).not.toContain("senha-secreta");
    }
  });

  it.each([
    ["segredo curto", { BETTER_AUTH_SECRET: "x".repeat(31) }],
    ["URL sem http", { BETTER_AUTH_URL: "ftp://exemplo.com" }],
    ["nome de banco inválido", { MONGODB_DB_NAME: "a/b" }],
    ["flag inválida", { AUTH_ALLOW_DEV_SIGNUP: "sim" }],
  ])("rejeita %s", (_name, override) => {
    expect(() => parseServerEnv({ ...valid, ...override })).toThrow(ServerConfigurationError);
  });
});
