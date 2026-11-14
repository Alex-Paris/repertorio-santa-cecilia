import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as items from "@/app/api/v1/library/repertoires/[id]/items/route";
import * as item from "@/app/api/v1/library/repertoires/[id]/items/[itemId]/route";
import * as move from "@/app/api/v1/library/repertoires/[id]/items/[itemId]/move/route";
import * as repertoire from "@/app/api/v1/library/repertoires/[id]/route";
import * as repertoires from "@/app/api/v1/library/repertoires/route";
import * as song from "@/app/api/v1/library/songs/[id]/route";
import * as songs from "@/app/api/v1/library/songs/route";
import { SongModel } from "@/server/database/models/song-model";

import { createTestUser, dropTestDatabase, hostedSong, ORIGIN, type TestUser } from "./helpers";

let userA: TestUser;
let userB: TestUser;

beforeAll(async () => {
  userA = await createTestUser("usuaria-a");
  userB = await createTestUser("usuario-b");
});
afterAll(dropTestDatabase);

function request(method: string, cookie: string | undefined, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/v1/library`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

function params<P>(value: P): { params: Promise<P> } {
  return { params: Promise.resolve(value) };
}

const none = params({});

async function createSong(user: TestUser, overrides: object = {}) {
  const response = await songs.POST(request("POST", user.cookie, { ...hostedSong, ...overrides }), none);
  expect(response.status).toBe(201);
  return (await response.json()).song;
}

describe("sem sessão", () => {
  it.each([
    ["GET músicas", () => songs.GET(request("GET", undefined), none)],
    ["POST músicas", () => songs.POST(request("POST", undefined, hostedSong), none)],
    ["GET música", () => song.GET(request("GET", undefined), params({ id: "x" }))],
    ["DELETE música", () => song.DELETE(request("DELETE", undefined), params({ id: "x" }))],
    ["GET repertórios", () => repertoires.GET(request("GET", undefined), none)],
    ["POST item", () => items.POST(request("POST", undefined, { songId: "x" }), params({ id: "x" }))],
  ])("%s responde 401", async (_name, call) => {
    const response = await call();

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "unauthenticated" } });
  });

  it("não aceita cookie forjado", async () => {
    const response = await songs.GET(request("GET", "better-auth.session_token=forjado.x"), none);
    expect(response.status).toBe(401);
  });
});

describe("com sessão", () => {
  it("cria e devolve o modelo de domínio, sem campos internos e sem cache", async () => {
    const response = await songs.POST(request("POST", userA.cookie, hostedSong), none);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(Object.keys(body.song).sort()).toEqual(
      ["artist", "chordPro", "contentType", "createdAt", "id", "originalKey", "revision", "title", "updatedAt"].sort(),
    );
    expect((await SongModel.findOne({ id: body.song.id }).lean())?.ownerId).toBe(userA.id);
  });

  it("rejeita ownerId enviado pelo cliente", async () => {
    const response = await songs.POST(request("POST", userA.cookie, { ...hostedSong, ownerId: userB.id }), none);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_input");
    expect(body.error.fields).toContain("");
  });

  it("valida o conteúdo e não expõe detalhes internos", async () => {
    const response = await songs.POST(request("POST", userA.cookie, { ...hostedSong, title: "" }), none);
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).not.toMatch(/stack|mongoose|mongodb/i);
  });

  it("rejeita JSON malformado, tipo incorreto e conteúdo grande demais", async () => {
    expect((await songs.POST(request("POST", userA.cookie, "{ quebrado"), none)).status).toBe(400);
    expect(
      (await songs.POST(request("POST", userA.cookie, JSON.stringify(hostedSong), { "content-type": "text/plain" }), none)).status,
    ).toBe(415);
    expect(
      (await songs.POST(request("POST", userA.cookie, { ...hostedSong, chordPro: "á".repeat(300_000) }), none)).status,
    ).toBe(413);
  });

  it("recusa alteração vinda de outra origem", async () => {
    const response = await songs.POST(
      request("POST", userA.cookie, hostedSong, { origin: "https://site-malicioso.example" }),
      none,
    );
    expect(response.status).toBe(403);
  });

  it("completa o ciclo de um repertório pela API", async () => {
    const first = await createSong(userA, { title: "Primeira" });
    const second = await createSong(userA, { title: "Segunda" });

    const created = await (await repertoires.POST(request("POST", userA.cookie, { name: "Show", description: "" }), none)).json();
    const id = created.repertoire.id;

    // Toda escrita informa a revisão esperada em If-Match (Etapa 2D.1).
    await items.POST(request("POST", userA.cookie, { songId: first.id }, { "If-Match": '"1"' }), params({ id }));
    const added = await (await items.POST(request("POST", userA.cookie, { songId: second.id }, { "If-Match": '"2"' }), params({ id }))).json();
    const [itemA, itemB] = added.repertoire.items;

    const moved = await (await move.POST(request("POST", userA.cookie, { direction: "up" }, { "If-Match": '"3"' }), params({ id, itemId: itemB.id }))).json();
    expect(moved.repertoire.items.find((i: { id: string }) => i.id === itemB.id).position).toBe(1);

    const tuned = await (await item.PATCH(request("PATCH", userA.cookie, { transposeSemitones: 2, notes: "Forte" }, { "If-Match": '"4"' }), params({ id, itemId: itemA.id }))).json();
    expect(tuned.repertoire.items.find((i: { id: string }) => i.id === itemA.id)).toMatchObject({ transposeSemitones: 2, notes: "Forte" });

    const inUse = await song.DELETE(request("DELETE", userA.cookie, undefined, { "If-Match": '"1"' }), params({ id: first.id }));
    expect(inUse.status).toBe(409);
    expect(await inUse.json()).toMatchObject({ error: { code: "conflict", repertoires: [{ id, name: "Show" }] } });

    expect((await item.DELETE(request("DELETE", userA.cookie, undefined, { "If-Match": '"5"' }), params({ id, itemId: itemA.id }))).status).toBe(200);
    expect((await song.DELETE(request("DELETE", userA.cookie, undefined, { "If-Match": '"1"' }), params({ id: first.id }))).status).toBe(204);
    expect((await repertoire.DELETE(request("DELETE", userA.cookie, undefined, { "If-Match": '"6"' }), params({ id }))).status).toBe(204);
  });
});

describe("isolamento pela API", () => {
  it("recurso de outro usuário responde igual a um inexistente", async () => {
    const privateSong = await createSong(userA);

    const other = await song.GET(request("GET", userB.cookie), params({ id: privateSong.id }));
    const missing = await song.GET(request("GET", userB.cookie), params({ id: "inexistente" }));

    expect(other.status).toBe(404);
    expect(await other.json()).toEqual(await missing.json());
  });

  it("B não edita, não exclui e não usa a música de A", async () => {
    const privateSong = await createSong(userA, { title: "Privada" });
    const created = await (await repertoires.POST(request("POST", userB.cookie, { name: "De B", description: "" }), none)).json();

    expect((await song.PUT(request("PUT", userB.cookie, { ...hostedSong, title: "X" }, { "If-Match": '"1"' }), params({ id: privateSong.id }))).status).toBe(404);
    expect((await song.DELETE(request("DELETE", userB.cookie, undefined, { "If-Match": '"1"' }), params({ id: privateSong.id }))).status).toBe(404);
    expect((await items.POST(request("POST", userB.cookie, { songId: privateSong.id }, { "If-Match": '"1"' }), params({ id: created.repertoire.id }))).status).toBe(404);

    const read = await (await song.GET(request("GET", userA.cookie), params({ id: privateSong.id }))).json();
    expect(read.song.title).toBe("Privada");
  });

  it("a listagem traz apenas as músicas do usuário da sessão", async () => {
    const mine = await createSong(userB, { title: "Só de B" });

    const body = await (await songs.GET(request("GET", userB.cookie), none)).json();

    expect(body.songs.map((s: { id: string }) => s.id)).toEqual([mine.id]);
  });
});
