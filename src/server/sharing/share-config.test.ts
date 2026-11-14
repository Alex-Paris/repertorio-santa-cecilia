// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseSharingConfig } from "./share-config";

const SECRET = "chave-de-teste-com-mais-de-32-caracteres";

afterEach(() => vi.restoreAllMocks());

describe("configuração do compartilhamento", () => {
  it("fica desligado por padrão", () => {
    expect(parseSharingConfig({}).enabled).toBe(false);
  });

  it("fica desligado mesmo em produção sem ativação explícita", () => {
    expect(parseSharingConfig({ NODE_ENV: "production", SHARE_LINK_SECRET: SECRET }).enabled).toBe(false);
  });

  it("ativa somente com a flag e a chave", () => {
    expect(parseSharingConfig({ PUBLIC_SHARING_ENABLED: "true", SHARE_LINK_SECRET: SECRET }).enabled).toBe(true);
  });

  it("não ativa sem chave", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(parseSharingConfig({ PUBLIC_SHARING_ENABLED: "true" }).enabled).toBe(false);
    expect(error).toHaveBeenCalledOnce();
  });

  it("aceita variáveis vazias, como as entregues pelo Docker Compose", () => {
    const config = parseSharingConfig({
      PUBLIC_SHARING_ENABLED: "",
      SHARE_LINK_SECRET: "",
      SHARE_MAX_ITEMS: "",
    });

    expect(config.enabled).toBe(false);
    expect(config.limits.itemsPerShare).toBe(200);
  });

  it("desliga com uma chave curta, sem registrar o valor", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const config = parseSharingConfig({ PUBLIC_SHARING_ENABLED: "true", SHARE_LINK_SECRET: "curta-demais" });

    expect(config).toMatchObject({ enabled: false, secret: null });
    expect(String(error.mock.calls[0][0])).toContain("SHARE_LINK_SECRET");
    expect(String(error.mock.calls[0][0])).not.toContain("curta-demais");
  });

  it("lê limites configurados", () => {
    const { limits } = parseSharingConfig({
      SHARE_MAX_LINKS_PER_REPERTOIRE: "3",
      SHARE_MAX_LINKS_PER_USER: "7",
      SHARE_MAX_WRITES_PER_HOUR: "2",
    });

    expect(limits).toMatchObject({ linksPerRepertoire: 3, linksPerUser: 7, writesPerHour: 2 });
  });

  it("recusa um limite de snapshot acima do que o MongoDB comporta", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(
      parseSharingConfig({
        PUBLIC_SHARING_ENABLED: "true",
        SHARE_LINK_SECRET: SECRET,
        SHARE_MAX_SNAPSHOT_BYTES: String(20 * 1024 * 1024),
      }).enabled,
    ).toBe(false);
  });
});
