import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as publicRoute from "@/app/api/v1/public/shares/[token]/route";
import * as previewRoute from "@/app/api/v1/library/repertoires/[id]/shares/preview/route";
import * as shareRoute from "@/app/api/v1/library/repertoires/[id]/shares/[shareId]/route";
import * as updatePreviewRoute from "@/app/api/v1/library/repertoires/[id]/shares/[shareId]/preview/route";
import * as sharesRoute from "@/app/api/v1/library/repertoires/[id]/shares/route";
import * as songsRoute from "@/app/api/v1/library/songs/route";
import { RIGHTS_DECLARATION_VERSION, type ShareSelection, type ShareSummary } from "@/features/sharing/domain/public-share";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { RepertoireShareModel } from "@/server/database/models/repertoire-share-model";
import { createLibraryService, type LibraryService } from "@/server/library/library-service";

import { clearDatabase, createTestUser, dropTestDatabase, externalSong, hostedSong, ORIGIN, type TestUser } from "./helpers";
import { latest } from "@/test/latest-revision";

const SECRET = "chave-de-integracao-com-mais-de-32-caracteres";

const hosted = {
  title: hostedSong.title,
  artist: hostedSong.artist,
  originalKey: hostedSong.originalKey,
  contentType: "original" as const,
  chordPro: "[G]Texto",
};

let userA: TestUser;
let userB: TestUser;
let library: LibraryService;

beforeEach(async () => {
  vi.stubEnv("PUBLIC_SHARING_ENABLED", "true");
  vi.stubEnv("SHARE_LINK_SECRET", SECRET);
  await clearDatabase();
  userA = await createTestUser("usuaria-a");
  userB = await createTestUser("usuario-b");
  library = createLibraryService(userA.id);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(dropTestDatabase);

function allow(...songIds: string[]): ShareSelection {
  return {
    authorizations: songIds.map((songId) => ({
      songId,
      confirmed: true as const,
      declarationVersion: RIGHTS_DECLARATION_VERSION,
    })),
  };
}

async function setup() {
  const first = await library.songs.create({ ...hosted, title: "Primeira", chordPro: "[G]Cifra autorizada" });
  const second = await library.songs.create({
    ...hosted,
    title: "Segunda",
    contentType: "authorized",
    chordPro: "[C]Cifra NAO AUTORIZADA",
  });
  const third = await library.songs.create(externalSong);
  const repertoire = await library.repertoires.create({ name: "Show", description: "Domingo" });

  await latest(library).repertoires.addSong(repertoire.id, first.id);
  await latest(library).repertoires.addSong(repertoire.id, second.id);
  const full = await latest(library).repertoires.addSong(repertoire.id, third.id);
  await latest(library).repertoires.updateItem(repertoire.id, full.items[0].id, {
    transposeSemitones: 2,
    notes: "ANOTACAO PRIVADA",
  });

  return { first, second, third, repertoire: full };
}

async function publish(repertoireId: string, selection: ShareSelection = allow()): Promise<ShareSummary> {
  const { contentHash } = await library.shares.preview(repertoireId, selection);
  return library.shares.create(repertoireId, { ...selection, expectedHash: contentHash });
}

async function update(share: ShareSummary, selection: ShareSelection = allow()): Promise<ShareSummary> {
  const { contentHash } = await library.shares.previewUpdate(share.repertoireId, share.id, selection);
  return library.shares.update(share.repertoireId, share.id, {
    ...selection,
    expectedHash: contentHash,
    expectedRevision: share.revision,
  });
}

function tokenOf(share: ShareSummary): string {
  return share.path!.replace("/s/", "");
}

async function openPublic(token: string, cookie?: string): Promise<Response> {
  return publicRoute.GET(
    new Request(`${ORIGIN}/api/v1/public/shares/${token}`, { headers: cookie ? { cookie } : {} }),
    { params: Promise.resolve({ token }) },
  );
}

async function publicBody(share: ShareSummary) {
  const response = await openPublic(tokenOf(share));
  expect(response.status).toBe(200);
  return ((await response.json()) as { share: { name: string; items: { title: string; content: { kind: string; chordPro?: string } }[] } }).share;
}

function request(user: TestUser | null, method: string, body?: unknown): Request {
  return new Request(`${ORIGIN}/api/v1/library/x`, {
    method,
    headers: {
      origin: ORIGIN,
      ...(user ? { cookie: user.cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function repertoireParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function shareParams(id: string, shareId: string) {
  return { params: Promise.resolve({ id, shareId }) };
}

async function statusOf(id: string) {
  return RepertoireShareModel.findOne({ id }).lean();
}

describe("cenário A: criar compartilhamento", () => {
  it("publica pela API e abre sem sessão, somente com os dados publicados e na ordem", async () => {
    const { first, repertoire } = await setup();
    const selection = allow(first.id);

    const previewResponse = await previewRoute.POST(request(userA, "POST", selection), repertoireParams(repertoire.id));
    expect(previewResponse.status).toBe(200);
    const { preview } = (await previewResponse.json()) as { preview: { contentHash: string } };

    expect(await RepertoireShareModel.countDocuments({})).toBe(0);

    const created = await sharesRoute.POST(
      request(userA, "POST", { ...selection, expectedHash: preview.contentHash }),
      repertoireParams(repertoire.id),
    );
    expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("private, no-store");
    const { share } = (await created.json()) as { share: ShareSummary };

    const response = await openPublic(tokenOf(share));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");

    const body = (await response.json()) as { share: { name: string; description: string; items: { title: string; transposeSemitones: number; content: { kind: string } }[] } };
    expect(body.share.name).toBe("Show");
    expect(body.share.description).toBe("Domingo");
    expect(body.share.items.map((item) => item.title)).toEqual(["Primeira", "Segunda", externalSong.title]);
    expect(body.share.items.map((item) => item.content.kind)).toEqual(["chordpro", "none", "external-link"]);
    expect(body.share.items[0].transposeSemitones).toBe(2);
  });

  it("registra a declaração de direitos com data e versão", async () => {
    const { first, repertoire } = await setup();

    const share = await publish(repertoire.id, allow(first.id));

    const document = await statusOf(share.id);
    expect(document?.authorizations).toHaveLength(1);
    expect(document?.authorizations[0]).toMatchObject({
      songId: first.id,
      declarationVersion: RIGHTS_DECLARATION_VERSION,
    });
    expect(document?.authorizations[0].confirmedAt).toBeInstanceOf(Date);
  });

  it("permite vários links para o mesmo repertório, com links diferentes", async () => {
    const { repertoire } = await setup();

    const [one, two] = [await publish(repertoire.id), await publish(repertoire.id)];

    expect(one.path).not.toBe(two.path);
    expect(await library.shares.listForRepertoire(repertoire.id)).toHaveLength(2);
    expect(await library.shares.listAll()).toHaveLength(2);
  });

  it("não marca o repertório privado como público", async () => {
    const { repertoire } = await setup();
    await publish(repertoire.id);

    const document = await RepertoireModel.findOne({ id: repertoire.id }).lean();
    expect(document).not.toHaveProperty("public");
  });
});

describe("cenário B: privacidade", () => {
  it("o conteúdo público não contém dados privados", async () => {
    const { first, repertoire } = await setup();
    const share = await publish(repertoire.id, allow(first.id));

    const text = await (await openPublic(tokenOf(share))).text();

    for (const forbidden of [
      "ANOTACAO PRIVADA",
      "NAO AUTORIZADA",
      "notes",
      userA.id,
      userA.email,
      repertoire.id,
      first.id,
      repertoire.items[0].id,
      "ownerId",
      "_id",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("nem o documento guardado contém notas ou cifras não autorizadas no snapshot", async () => {
    const { first, repertoire } = await setup();
    const share = await publish(repertoire.id, allow(first.id));

    const document = await statusOf(share.id);

    expect(JSON.stringify(document?.snapshot)).not.toContain("ANOTACAO");
    expect(JSON.stringify(document?.snapshot)).not.toContain("NAO AUTORIZADA");
  });

  it("a sessão de quem abre o link não muda o que é entregue", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);

    const anonymous = await (await openPublic(tokenOf(share))).text();
    const withSession = await (await openPublic(tokenOf(share), userB.cookie)).text();

    expect(withSession).toBe(anonymous);
  });

  it("o acesso anônimo à API privada continua bloqueado", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);

    const responses = await Promise.all([
      songsRoute.GET(request(null, "GET"), repertoireParams("x")),
      sharesRoute.GET(request(null, "GET"), repertoireParams(repertoire.id)),
      previewRoute.POST(request(null, "POST", allow()), repertoireParams(repertoire.id)),
      shareRoute.DELETE(request(null, "DELETE"), shareParams(repertoire.id, share.id)),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401]);
    expect((await statusOf(share.id))?.status).toBe("active");
  });

  it("o resumo do proprietário não expõe documentos internos", async () => {
    const { repertoire } = await setup();
    await publish(repertoire.id);

    const response = await sharesRoute.GET(request(userA, "GET"), repertoireParams(repertoire.id));
    const text = await response.text();

    expect(text).not.toContain("ownerId");
    expect(text).not.toContain("snapshot");
    expect(text).not.toContain("_id");
  });

  it("recusa payload que tenta impor tipo ou dono", async () => {
    const { first, repertoire } = await setup();

    const tampered = await previewRoute.POST(
      request(userA, "POST", {
        authorizations: [
          { songId: first.id, confirmed: true, declarationVersion: RIGHTS_DECLARATION_VERSION, contentType: "original" },
        ],
      }),
      repertoireParams(repertoire.id),
    );
    const withOwner = await previewRoute.POST(
      request(userA, "POST", { authorizations: [], ownerId: userB.id }),
      repertoireParams(repertoire.id),
    );

    expect([tampered.status, withOwner.status]).toEqual([400, 400]);
  });

  it("não publica a cifra de um link externo, mesmo com autorização enviada", async () => {
    const { third, repertoire } = await setup();

    await expect(library.shares.preview(repertoire.id, allow(third.id))).rejects.toMatchObject({
      code: "invalid-data",
    });
  });
});

describe("cenário C: atualização", () => {
  it("mantém o snapshot até a atualização explícita, preservando o link", async () => {
    const { first, repertoire } = await setup();
    const share = await publish(repertoire.id, allow(first.id));

    await latest(library).songs.update(first.id, { ...hosted, title: "Primeira Editada", chordPro: "[G]Texto novo" });
    await latest(library).repertoires.update(repertoire.id, { name: "Show Renomeado", description: "" });

    const unchanged = await publicBody(share);
    expect(unchanged.name).toBe("Show");
    expect(unchanged.items[0].title).toBe("Primeira");

    const [listed] = await library.shares.listForRepertoire(repertoire.id);
    expect(listed.outdated).toBe(true);

    const updated = await update(listed, allow(first.id));

    expect(updated.path).toBe(share.path);
    expect(updated.revision).toBe(share.revision + 1);
    expect(updated.outdated).toBe(false);

    const changed = await publicBody(share);
    expect(changed.name).toBe("Show Renomeado");
    expect(changed.items[0].title).toBe("Primeira Editada");
    expect(changed.items[0].content.chordPro).toBe("[G]Texto novo");
  });

  it("uma música removida segue no link até atualizar, e o proprietário é avisado", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);

    await latest(library).repertoires.removeItem(repertoire.id, repertoire.items[1].id);

    expect((await publicBody(share)).items).toHaveLength(3);
    const [listed] = await library.shares.listForRepertoire(repertoire.id);
    expect(listed.removedTitles).toEqual(["Segunda"]);

    await update(listed);

    expect((await publicBody(share)).items).toHaveLength(2);
    expect((await library.shares.listForRepertoire(repertoire.id))[0].removedTitles).toEqual([]);
  });

  it("uma cifra alterada perde a autorização reaproveitável", async () => {
    const { first, repertoire } = await setup();
    await publish(repertoire.id, allow(first.id));

    expect((await library.shares.listForRepertoire(repertoire.id))[0].authorizedSongIds).toEqual([first.id]);

    await latest(library).songs.update(first.id, { ...hosted, chordPro: "[A]Outro texto" });

    expect((await library.shares.listForRepertoire(repertoire.id))[0].authorizedSongIds).toEqual([]);
  });

  it("detecta alteração entre a prévia e a confirmação ao criar", async () => {
    const { repertoire } = await setup();
    const selection = allow();
    const { contentHash } = await library.shares.preview(repertoire.id, selection);

    await latest(library).repertoires.update(repertoire.id, { name: "Mudou", description: "" });

    await expect(
      library.shares.create(repertoire.id, { ...selection, expectedHash: contentHash }),
    ).rejects.toMatchObject({ code: "share-preview-outdated" });
    expect(await RepertoireShareModel.countDocuments({})).toBe(0);
  });

  it("detecta alteração entre a prévia e a confirmação ao atualizar", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);
    const selection = allow();
    const { contentHash } = await library.shares.previewUpdate(repertoire.id, share.id, selection);

    await latest(library).repertoires.update(repertoire.id, { name: "Mudou", description: "" });

    await expect(
      library.shares.update(repertoire.id, share.id, {
        ...selection,
        expectedHash: contentHash,
        expectedRevision: share.revision,
      }),
    ).rejects.toMatchObject({ code: "share-preview-outdated" });
    expect((await publicBody(share)).name).toBe("Show");
  });

  it("a prévia de atualização não altera a publicação", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);
    await latest(library).repertoires.update(repertoire.id, { name: "Mudou", description: "" });

    const response = await updatePreviewRoute.POST(request(userA, "POST", allow()), shareParams(repertoire.id, share.id));

    expect(response.status).toBe(200);
    expect((await statusOf(share.id))?.revision).toBe(share.revision);
    expect((await publicBody(share)).name).toBe("Show");
  });

  it("recusa uma revisão antiga", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);
    await update(share);

    await expect(update(share)).rejects.toMatchObject({ code: "share-conflict" });
    expect((await statusOf(share.id))?.revision).toBe(share.revision + 1);
  });
});

describe("cenário D: revogação", () => {
  it("o link deixa de funcionar imediatamente, sem afetar os dados privados", async () => {
    const { first, repertoire } = await setup();
    const share = await publish(repertoire.id, allow(first.id));
    expect((await openPublic(tokenOf(share))).status).toBe(200);

    const response = await shareRoute.DELETE(request(userA, "DELETE"), shareParams(repertoire.id, share.id));
    expect(response.status).toBe(204);

    expect((await openPublic(tokenOf(share))).status).toBe(404);
    expect(await library.songs.findById(first.id)).not.toBeNull();
    const kept = await library.repertoires.findById(repertoire.id);
    expect(kept?.items).toHaveLength(3);
    expect(kept?.items[0].notes).toBe("ANOTACAO PRIVADA");
  });

  it("apaga o conteúdo publicado e invalida a versão da assinatura", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);

    await library.shares.revoke(repertoire.id, share.id);

    const document = await statusOf(share.id);
    expect(document?.status).toBe("revoked");
    expect(document?.snapshot).toBeUndefined();
    expect(document?.tokenVersion).toBe(2);
    expect(document?.revokedAt).toBeInstanceOf(Date);
  });

  it("revogado, inválido e inexistente têm respostas idênticas", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);
    await library.shares.revoke(repertoire.id, share.id);

    const responses = await Promise.all([
      openPublic(tokenOf(share)),
      openPublic("nao-e-um-token"),
      openPublic(`${"a".repeat(22)}.${"b".repeat(43)}`),
    ]);

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404]);
    const [revoked, malformed, unknown] = await Promise.all(responses.map((response) => response.text()));
    expect(malformed).toBe(revoked);
    expect(unknown).toBe(revoked);
  });

  it("uma assinatura forjada para um ID real é recusada", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);

    const response = await openPublic(`${share.id}.${"b".repeat(43)}`);

    expect(response.status).toBe(404);
  });

  it("não pode ser atualizada nem revogada de novo", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);
    const { contentHash } = await library.shares.previewUpdate(repertoire.id, share.id, allow());
    await library.shares.revoke(repertoire.id, share.id);

    await expect(
      library.shares.update(repertoire.id, share.id, {
        ...allow(),
        expectedHash: contentHash,
        expectedRevision: share.revision,
      }),
    ).rejects.toMatchObject({ code: "share-conflict" });
    await expect(library.shares.revoke(repertoire.id, share.id)).rejects.toMatchObject({
      code: "share-not-found",
    });
    expect((await openPublic(tokenOf(share))).status).toBe(404);
    expect(await library.shares.listForRepertoire(repertoire.id)).toEqual([]);
  });

  it("excluir o repertório revoga as publicações na mesma operação", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);

    await latest(library).repertoires.delete(repertoire.id);

    expect((await statusOf(share.id))?.status).toBe("revoked");
    expect((await openPublic(tokenOf(share))).status).toBe(404);
  });

  it("a exclusão de uma música não apaga o que já foi publicado, e o dono consegue ver", async () => {
    const { repertoire, second } = await setup();
    const share = await publish(repertoire.id);
    await latest(library).repertoires.removeItem(repertoire.id, repertoire.items[1].id);
    await latest(library).songs.delete(second.id);

    expect((await publicBody(share)).items.map((item) => item.title)).toContain("Segunda");
    expect((await library.shares.listAll())[0].removedTitles).toEqual(["Segunda"]);
  });
});

describe("cenário E: isolamento", () => {
  it("a conta B não administra as publicações da conta A", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);

    const body = { ...allow(), expectedHash: "a".repeat(64), expectedRevision: 1 };
    const responses = await Promise.all([
      sharesRoute.GET(request(userB, "GET"), repertoireParams(repertoire.id)),
      previewRoute.POST(request(userB, "POST", allow()), repertoireParams(repertoire.id)),
      sharesRoute.POST(request(userB, "POST", { ...allow(), expectedHash: "a".repeat(64) }), repertoireParams(repertoire.id)),
      updatePreviewRoute.POST(request(userB, "POST", allow()), shareParams(repertoire.id, share.id)),
      shareRoute.PUT(request(userB, "PUT", body), shareParams(repertoire.id, share.id)),
      shareRoute.DELETE(request(userB, "DELETE"), shareParams(repertoire.id, share.id)),
    ]);

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404, 404, 404]);
    expect((await statusOf(share.id))?.revision).toBe(share.revision);
    expect((await publicBody(share)).name).toBe("Show");
  });

  it("o repertório próprio da conta B não alcança publicações da conta A", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);
    const other = createLibraryService(userB.id);
    const own = await other.repertoires.create({ name: "De B", description: "" });

    await expect(other.shares.revoke(own.id, share.id)).rejects.toMatchObject({ code: "share-not-found" });
    await expect(other.shares.revoke(repertoire.id, share.id)).rejects.toMatchObject({ code: "share-not-found" });
    expect((await statusOf(share.id))?.status).toBe("active");
  });

  it("a conta B não publica cifras da conta A usando autorizações próprias", async () => {
    const { first } = await setup();
    const other = createLibraryService(userB.id);
    const ownSong = await other.songs.create(hostedSong);
    const own = await other.repertoires.create({ name: "De B", description: "" });
    await latest(other).repertoires.addSong(own.id, ownSong.id);

    await expect(other.shares.preview(own.id, allow(first.id))).rejects.toMatchObject({
      code: "share-preview-outdated",
    });
  });

  it("a conta B não vê publicações da conta A na própria lista", async () => {
    const { repertoire } = await setup();
    await publish(repertoire.id);

    expect(await createLibraryService(userB.id).shares.listAll()).toEqual([]);
  });
});

describe("cenário F: concorrência", () => {
  it("atualizações simultâneas: apenas uma vence", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);
    const selection = allow();
    const { contentHash } = await library.shares.previewUpdate(repertoire.id, share.id, selection);
    const input = { ...selection, expectedHash: contentHash, expectedRevision: share.revision };

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => library.shares.update(repertoire.id, share.id, input)),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    for (const result of results) {
      if (result.status === "rejected") {
        expect(result.reason).toMatchObject({ code: "share-conflict" });
      }
    }
    expect((await statusOf(share.id))?.revision).toBe(share.revision + 1);
  });

  it("revogar durante a atualização nunca reativa o link", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await clearDatabase();
      userA = await createTestUser("concorrente");
      library = createLibraryService(userA.id);
      const { repertoire } = await setup();
      const share = await publish(repertoire.id);
      const selection = allow();
      const { contentHash } = await library.shares.previewUpdate(repertoire.id, share.id, selection);

      await Promise.allSettled([
        library.shares.update(repertoire.id, share.id, {
          ...selection,
          expectedHash: contentHash,
          expectedRevision: share.revision,
        }),
        library.shares.revoke(repertoire.id, share.id),
      ]);

      const document = await statusOf(share.id);
      expect(document?.status).toBe("revoked");
      expect(document?.snapshot).toBeUndefined();
      expect((await openPublic(tokenOf(share))).status).toBe(404);
    }
  });

  it("excluir o repertório durante uma criação não deixa publicação órfã", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await clearDatabase();
      userA = await createTestUser("concorrente");
      library = createLibraryService(userA.id);
      const { repertoire } = await setup();
      const selection = allow();
      const { contentHash } = await library.shares.preview(repertoire.id, selection);

      await Promise.allSettled([
        library.shares.create(repertoire.id, { ...selection, expectedHash: contentHash }),
        latest(library).repertoires.delete(repertoire.id),
      ]);

      expect(await RepertoireModel.countDocuments({ id: repertoire.id })).toBe(0);
      expect(await RepertoireShareModel.countDocuments({ status: "active" })).toBe(0);
    }
  });

  it("excluir o repertório durante uma atualização também revoga", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await clearDatabase();
      userA = await createTestUser("concorrente");
      library = createLibraryService(userA.id);
      const { repertoire } = await setup();
      const share = await publish(repertoire.id);
      const selection = allow();
      const { contentHash } = await library.shares.previewUpdate(repertoire.id, share.id, selection);

      await Promise.allSettled([
        library.shares.update(repertoire.id, share.id, {
          ...selection,
          expectedHash: contentHash,
          expectedRevision: share.revision,
        }),
        latest(library).repertoires.delete(repertoire.id),
      ]);

      expect((await statusOf(share.id))?.status).toBe("revoked");
    }
  });

  it("a leitura pública durante a revogação nunca retorna dados parciais", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);

    const reads = Array.from({ length: 10 }, () => openPublic(tokenOf(share)));
    const [responses] = await Promise.all([Promise.all(reads), library.shares.revoke(repertoire.id, share.id)]);

    for (const response of responses) {
      if (response.status === 200) {
        expect(((await response.json()) as { share: { items: unknown[] } }).share.items).toHaveLength(3);
      } else {
        expect(response.status).toBe(404);
      }
    }
    expect((await openPublic(tokenOf(share))).status).toBe(404);
  });

  it("criações simultâneas respeitam o limite por repertório", async () => {
    vi.stubEnv("SHARE_MAX_LINKS_PER_REPERTOIRE", "2");
    const { repertoire } = await setup();
    const selection = allow();
    const { contentHash } = await library.shares.preview(repertoire.id, selection);

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        library.shares.create(repertoire.id, { ...selection, expectedHash: contentHash }),
      ),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    expect(await RepertoireShareModel.countDocuments({ status: "active" })).toBe(2);
  });
});

describe("limites e flag", () => {
  it("aplica o limite de links por conta", async () => {
    vi.stubEnv("SHARE_MAX_LINKS_PER_USER", "1");
    const { repertoire } = await setup();
    await publish(repertoire.id);

    await expect(publish(repertoire.id)).rejects.toMatchObject({ code: "share-limit-exceeded" });
  });

  it("aplica o limite de músicas", async () => {
    vi.stubEnv("SHARE_MAX_ITEMS", "2");
    const { repertoire } = await setup();

    await expect(library.shares.preview(repertoire.id, allow())).rejects.toMatchObject({
      code: "share-limit-exceeded",
    });
  });

  it("aplica o limite de tamanho", async () => {
    vi.stubEnv("SHARE_MAX_SNAPSHOT_BYTES", "50");
    const { repertoire } = await setup();

    await expect(library.shares.preview(repertoire.id, allow())).rejects.toMatchObject({
      code: "share-limit-exceeded",
    });
  });

  it("limita a frequência com contador no banco e responde 429", async () => {
    vi.stubEnv("SHARE_MAX_WRITES_PER_HOUR", "1");
    const { repertoire } = await setup();
    const selection = allow();
    const { contentHash } = await library.shares.preview(repertoire.id, selection);
    await library.shares.create(repertoire.id, { ...selection, expectedHash: contentHash });

    const response = await sharesRoute.POST(
      request(userA, "POST", { ...selection, expectedHash: contentHash }),
      repertoireParams(repertoire.id),
    );

    expect(response.status).toBe(429);
  });

  it("com a flag desligada, não cria, não atualiza nem mostra; revogar continua possível", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);
    const selection = allow();
    const { contentHash } = await library.shares.previewUpdate(repertoire.id, share.id, selection);

    vi.stubEnv("PUBLIC_SHARING_ENABLED", "false");

    await expect(library.shares.preview(repertoire.id, selection)).rejects.toMatchObject({ code: "sharing-disabled" });
    await expect(
      library.shares.create(repertoire.id, { ...selection, expectedHash: contentHash }),
    ).rejects.toMatchObject({ code: "sharing-disabled" });
    await expect(
      library.shares.update(repertoire.id, share.id, {
        ...selection,
        expectedHash: contentHash,
        expectedRevision: share.revision,
      }),
    ).rejects.toMatchObject({ code: "sharing-disabled" });
    expect((await openPublic(tokenOf(share))).status).toBe(404);

    const list = await sharesRoute.GET(request(userA, "GET"), repertoireParams(repertoire.id));
    expect(((await list.json()) as { enabled: boolean }).enabled).toBe(false);

    await library.shares.revoke(repertoire.id, share.id);
    expect((await statusOf(share.id))?.status).toBe("revoked");
  });

  it("trocar a chave invalida os links existentes", async () => {
    const { repertoire } = await setup();
    const share = await publish(repertoire.id);

    vi.stubEnv("SHARE_LINK_SECRET", "outra-chave-de-integracao-com-32-caracteres");

    expect((await openPublic(tokenOf(share))).status).toBe(404);
  });
});
