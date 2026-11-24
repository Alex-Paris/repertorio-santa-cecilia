// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { LibraryError } from "@/features/library/domain/library-errors";
import { connectToMongoose } from "@/server/database/mongoose-connection";
import { parseServerEnv, ServerConfigurationError } from "@/server/env";

import { runPersistence } from "./persistence";

vi.mock("@/server/database/mongoose-connection", () => ({ connectToMongoose: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(connectToMongoose).mockReset();
});

describe("diagnóstico da persistência", () => {
  it("identifica as variáveis ausentes sem executar a operação ou expor detalhes ao visitante", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(connectToMongoose).mockRejectedValue(new ServerConfigurationError(["MONGODB_DB_NAME", "BETTER_AUTH_SECRET"]));
    const operation = vi.fn();

    await expect(runPersistence(operation)).rejects.toMatchObject({ code: "persistence-failed" });

    expect(operation).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("[persistência] Falha: ServerConfigurationError.", JSON.stringify({
      invalidVariables: ["MONGODB_DB_NAME", "BETTER_AUTH_SECRET"],
    }));
  });

  it("não registra valores inválidos das variáveis", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(connectToMongoose).mockImplementation(async () => {
      parseServerEnv({ MONGODB_URI: "postgres://usuario:senha-secreta@host-privado", BETTER_AUTH_SECRET: "segredo-curto" });
      throw new Error("Não deve chegar aqui");
    });

    await expect(runPersistence(vi.fn())).rejects.toBeInstanceOf(LibraryError);

    const output = JSON.stringify(log.mock.calls);
    expect(output).toContain("MONGODB_URI");
    expect(output).toContain("BETTER_AUTH_SECRET");
    expect(output).not.toMatch(/senha-secreta|segredo-curto|host-privado|postgres/);
  });

  it("continua omitindo mensagens e URI das exceções do driver", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(connectToMongoose).mockRejectedValue(Object.assign(new Error("mongodb://usuario:senha-secreta@host"), { name: "MongoNetworkError" }));

    await expect(runPersistence(vi.fn())).rejects.toMatchObject({ code: "persistence-failed" });

    expect(log).toHaveBeenCalledWith("[persistência] Falha: MongoNetworkError.");
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/mongodb|senha-secreta/);
  });

  it("mantém o erro de domínio sem registrar dados da operação", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(connectToMongoose).mockResolvedValue(undefined as never);
    const error = new LibraryError("conflict");

    await expect(runPersistence(async () => { throw error; })).rejects.toBe(error);
    expect(log).not.toHaveBeenCalled();
  });
});
