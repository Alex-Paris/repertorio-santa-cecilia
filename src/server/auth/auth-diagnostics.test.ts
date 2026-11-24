// @vitest-environment node
import { MongoServerSelectionError } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ServerConfigurationError } from "@/server/env";

import { reportAuthFailure } from "./auth-diagnostics";

afterEach(() => vi.restoreAllMocks());

function logged(log: ReturnType<typeof vi.spyOn>) {
  return JSON.parse(String(log.mock.calls[0][1]));
}

describe("diagnóstico seguro de autenticação", () => {
  it("identifica variáveis inválidas sem registrar valores ou mensagens", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new ServerConfigurationError(["MONGODB_DB_NAME", "BETTER_AUTH_SECRET", "valor-secreto"]);
    const requestId = reportAuthFailure(error, "prepare-auth");

    expect(logged(log)).toEqual({
      event: "auth-service-failure", requestId, phase: "prepare-auth",
      error: { type: "ServerConfigurationError" },
      invalidVariables: ["MONGODB_DB_NAME", "BETTER_AUTH_SECRET"],
    });
    expect(requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(JSON.stringify(log.mock.calls)).not.toContain("valor-secreto");
  });

  it("registra códigos de DNS e autenticação, sem expor URI, mensagem, stack ou metadados do servidor", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const network = Object.assign(new Error("mongodb+srv://usuario:senha@host-privado.test"), {
      name: "MongoNetworkError", code: "ECONNREFUSED",
      cause: Object.assign(new Error("senha-secreta"), { code: "ENOTFOUND" }),
    });
    const error = new MongoServerSelectionError("URI e senha que não podem aparecer", {
      servers: new Map([["host-privado.test", { error: network }]]),
    } as never);

    reportAuthFailure(error, "prepare-auth");

    expect(logged(log).servers).toEqual([{ type: "MongoNetworkError", code: "ECONNREFUSED", cause: { type: "Error", code: "ENOTFOUND" } }]);
    const output = JSON.stringify(log.mock.calls);
    expect(output).not.toMatch(/senha|mongodb|host-privado|stack|URI/);
  });

  it("preserva o código numérico de erro de autenticação do driver", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    reportAuthFailure(Object.assign(new Error("conteúdo privado"), { name: "MongoServerError", code: 18 }), "prepare-auth");
    expect(logged(log).error).toEqual({ type: "MongoServerError", code: 18 });
  });

  it("não registra nomes e códigos arbitrários que possam conter dados sensíveis", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    reportAuthFailure(Object.assign(new Error("senha"), { name: "nome-com-segredo", code: "codigo-secreto" }), "auth-handler");
    expect(logged(log).error).toEqual({ type: "UnknownError" });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/segredo|secreto|senha/);
  });

  it("trata erro não convencional sem serializar o objeto", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    reportAuthFailure({ token: "token-secreto", cookie: "cookie-secreto" }, "auth-handler");
    expect(logged(log).error).toEqual({ type: "UnknownError" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("secreto");
  });

  it("não deixa um getter inesperado impedir a resposta de indisponibilidade", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("segredo");
    Object.defineProperty(error, "name", { get() { throw new Error("segredo"); } });

    expect(() => reportAuthFailure(error, "prepare-auth")).not.toThrow();
    expect(logged(log).error).toEqual({ type: "UnknownError" });
  });
});
