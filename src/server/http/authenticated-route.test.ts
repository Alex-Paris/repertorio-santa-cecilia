// @vitest-environment node
import { notFound } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { LibraryError } from "@/features/library/domain/library-errors";

import { authenticatedRoute } from "./authenticated-route";

vi.mock("@/server/env", () => ({ getServerEnv: () => ({ BETTER_AUTH_URL: "http://localhost:3000" }) }));
vi.mock("@/server/auth/session", () => ({
  getSessionFromHeaders: vi.fn(async () => ({ user: { id: "u1" } })),
}));
vi.mock("@/server/library/library-service", () => ({ createLibraryService: () => ({}) }));

const context = { params: Promise.resolve({}) };
const request = new Request("http://localhost:3000/api/v1/library/shares");

describe("rota autenticada", () => {
  it("não transforma os sinais internos do Next em erro 500", async () => {
    const route = authenticatedRoute(async () => {
      notFound();
    });

    await expect(route(request, context)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
    });
  });

  it("continua convertendo erros de domínio em resposta", async () => {
    const route = authenticatedRoute(async () => {
      throw new LibraryError("share-not-found");
    });

    const response = await route(request, context);

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("marca respostas de sucesso como privadas", async () => {
    const route = authenticatedRoute(async () => new Response(null, { status: 204 }));

    expect((await route(request, context)).headers.get("cache-control")).toBe("private, no-store");
  });
});
