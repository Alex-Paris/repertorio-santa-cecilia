import { describe, expect, it } from "vitest";

import { celebrationQuerySchema } from "./celebration-query";

describe("busca de celebrações", () => {
  it("pagina por padrão e aceita os filtros", () => {
    expect(celebrationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 12 });
    expect(
      celebrationQuerySchema.parse({ from: "2026-11-01", to: "2026-12-31", q: "advento", season: "advento", status: "reviewed", page: "2" }),
    ).toEqual({ from: "2026-11-01", to: "2026-12-31", q: "advento", season: "advento", status: "reviewed", page: 2, pageSize: 12 });
  });

  it("limita o tamanho da página e o período", () => {
    expect(celebrationQuerySchema.safeParse({ pageSize: "51" }).success).toBe(false);
    expect(celebrationQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(celebrationQuerySchema.safeParse({ from: "2026-01-01", to: "2027-01-02" }).success).toBe(true);
    expect(celebrationQuerySchema.safeParse({ from: "2026-01-01", to: "2027-01-03" }).success).toBe(false);
    expect(celebrationQuerySchema.safeParse({ from: "2026-12-01", to: "2026-11-01" }).success).toBe(false);
  });

  it("recusa valores fora dos vocabulários, datas inválidas e parâmetros desconhecidos", () => {
    expect(celebrationQuerySchema.safeParse({ status: "aprovada" }).success).toBe(false);
    expect(celebrationQuerySchema.safeParse({ season: "verao" }).success).toBe(false);
    expect(celebrationQuerySchema.safeParse({ from: "2026-02-30" }).success).toBe(false);
    expect(celebrationQuerySchema.safeParse({ ownerId: "x" }).success).toBe(false);
    expect(celebrationQuerySchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
  });
});
