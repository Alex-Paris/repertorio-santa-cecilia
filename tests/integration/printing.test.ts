import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as repertoireRoute from "@/app/api/v1/library/repertoires/[id]/route";
import type { CatalogSongInput } from "@/features/catalog/domain/catalog-song";
import {
  buildRepertoirePrint,
  buildSharePrint,
  buildSongPrint,
  itemHeading,
  type PrintFormat,
} from "@/features/printing/domain/print-model";
import { buildRepertoireEntries } from "@/features/repertoires/services/repertoire-service";
import { RIGHTS_DECLARATION_VERSION, type ShareSelection } from "@/features/sharing/domain/public-share";
import { lyricsFromChordPro, lyricsToPlainText } from "@/features/songs/services/chordpro-lyrics";
import { createCatalogAdminService, getPublishedCatalogSong } from "@/server/catalog/catalog-service";
import { createLibraryService } from "@/server/library/library-service";
import { loadPublicShare } from "@/server/sharing/public-share-reader";
import { latest } from "@/test/latest-revision";

import { clearDatabase, createTestUser, dropTestDatabase, ORIGIN, type TestUser } from "./helpers";

/**
 * Etapa 2F.2: a impressão não tem rota de dados própria. Ela monta a folha com o que as fontes
 * autorizadas já entregam ao leitor (biblioteca da sessão, projeção pública do catálogo e o
 * retrato de um link público). Estes testes usam essas mesmas fontes, contra o MongoDB.
 */
const SECRET = "chave-de-integracao-com-mais-de-32-caracteres";

let userA: TestUser;
let userB: TestUser;

const HOSTED = "[D]Vinde, povo de [G]Deus\n\n{start_of_chorus}\n[A]Glória ao Se[D]nhor\n{end_of_chorus}";

function catalogInput(title: string, displayChordPro: boolean, shareChordPro = false): CatalogSongInput {
  const chordPro = displayChordPro ? "[G]Trigo [C]moído, uva pisada" : "[G]LETRA SEM PERMISSÃO [C]de exibição";
  return {
    song: { title, artist: "[TESTE] Coral", originalKey: "G", contentType: "original", chordPro },
    rights: { basis: "original-work", evidence: "[TESTE] Obra da casa.", displayChordPro, shareChordPro },
  };
}

async function publishedCatalog(title: string, displayChordPro: boolean, shareChordPro = false) {
  const admin = createCatalogAdminService("admin-teste");
  const draft = await admin.create(catalogInput(title, displayChordPro, shareChordPro));
  return admin.publish(draft.id, draft.revision);
}

/** O que a tela de impressão do repertório monta: biblioteca da conta + catálogo autorizado. */
async function printFor(user: TestUser, repertoireId: string, format: PrintFormat) {
  const library = createLibraryService(user.id);
  const [songs, repertoire] = await Promise.all([library.songs.list(), library.repertoires.findById(repertoireId)]);
  if (!repertoire) return null;
  const catalogSongs = await library.catalogSongsFor([repertoire]);
  return buildRepertoirePrint(buildRepertoireEntries(repertoire.items, songs, catalogSongs), format);
}

async function mixedRepertoire() {
  const library = latest(createLibraryService(userA.id));
  const personal = await library.songs.create({ title: "[TESTE] Hino", artist: "Autora", originalKey: "D", contentType: "original", chordPro: HOSTED });
  const external = await library.songs.create({ title: "[TESTE] Link", artist: "Banda", originalKey: "E", contentType: "external-link", sourceUrl: "https://example.com/cifra" });
  const shown = await publishedCatalog("[TESTE] Pão e Vinho", true);
  const hidden = await publishedCatalog("[TESTE] Ponte de Papel", false);

  const created = await library.repertoires.create({
    name: "[TESTE] Missa",
    description: "",
    mass: { date: "2026-11-22", title: "Cristo Rei" },
  });
  await library.repertoires.addSong(created.id, personal.id, "personal", "entrada");
  await library.repertoires.addSong(created.id, shown.id, "catalog", "comunhao");
  await library.repertoires.addSong(created.id, hidden.id, "catalog");
  let repertoire = await library.repertoires.addSong(created.id, external.id, "personal", "encerramento");
  const entry = repertoire.items.find((item) => item.songId === personal.id)!;
  repertoire = await library.repertoires.updateItem(repertoire.id, entry.id, { transposeSemitones: 2, notes: "NOTA PRIVADA" });
  return { repertoire, personal, external, shown, hidden };
}

beforeEach(async () => {
  vi.stubEnv("PUBLIC_SHARING_ENABLED", "true");
  vi.stubEnv("SHARE_LINK_SECRET", SECRET);
  await clearDatabase();
  userA = await createTestUser("leitora-a");
  userB = await createTestUser("leitor-b");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(dropTestDatabase);

describe("biblioteca particular e repertório misto", () => {
  it("imprime na ordem do repertório, com o momento de cada item e o tom do item", async () => {
    const { repertoire } = await mixedRepertoire();
    const items = (await printFor(userA, repertoire.id, "chords"))!;

    expect(items.map(itemHeading)).toEqual([
      "Entrada: [TESTE] Hino",
      "Comunhão: [TESTE] Pão e Vinho",
      "Encerramento: [TESTE] Link",
      // Sem momento: identificação neutra; o banco não ganhou classificação nenhuma.
      "Música 4: [TESTE] Ponte de Papel",
    ]);
    expect(repertoire.items.find((item) => item.position === 4)).not.toHaveProperty("moment");
    expect(items[0]).toMatchObject({ printKey: "E", semitones: 2, chordPro: HOSTED });
    expect(JSON.stringify(items)).not.toContain("NOTA PRIVADA");
  });

  it("catálogo: só a cifra com permissão de exibição; sem permissão ou link externo, só o aviso", async () => {
    const { repertoire } = await mixedRepertoire();
    const lyrics = (await printFor(userA, repertoire.id, "lyrics"))!;
    expect(lyrics.map((item) => item.unavailable ?? "ok")).toEqual(["ok", "ok", "external-link", "no-content"]);
    expect(lyricsToPlainText(lyricsFromChordPro(lyrics[1]!.chordPro!))).toBe("Trigo moído, uva pisada");
    // A cifra sem permissão nem chega ao navegador: não há o que esconder no papel.
    expect(JSON.stringify(lyrics)).not.toContain("SEM PERMISSÃO");
    expect(lyrics[3]).not.toHaveProperty("chordPro");
  });

  it("música do catálogo individual: rascunho e despublicada não existem para imprimir", async () => {
    const admin = createCatalogAdminService("admin-teste");
    const draft = await admin.create(catalogInput("[TESTE] Rascunho", true));
    expect(await getPublishedCatalogSong(draft.id)).toBeNull();

    const published = await admin.publish(draft.id, draft.revision);
    const view = (await getPublishedCatalogSong(published.id))!;
    expect(buildSongPrint(view, 0, "chords")).toMatchObject({ chordPro: "[G]Trigo [C]moído, uva pisada", printKey: "G" });

    await admin.unpublish(published.id, published.revision);
    expect(await getPublishedCatalogSong(published.id)).toBeNull();
  });

  it("a ordem impressa acompanha uma reordenação; alterações concorrentes não misturam versões", async () => {
    const { repertoire } = await mixedRepertoire();
    const library = createLibraryService(userA.id);
    const last = [...repertoire.items].sort((a, b) => a.position - b.position).at(-1)!;

    // Duas abas movem itens a partir da mesma revisão: só uma escrita vale.
    const results = await Promise.allSettled([
      library.repertoires.moveItem(repertoire.id, last.id, "up", repertoire.revision),
      library.repertoires.moveItem(repertoire.id, repertoire.items[0]!.id, "down", repertoire.revision),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "revision-conflict" } });

    const stored = (await library.repertoires.findById(repertoire.id))!;
    const items = (await printFor(userA, repertoire.id, "lyrics"))!;
    const expected = [...stored.items].sort((a, b) => a.position - b.position).map((item) => item.id);
    expect(items.map((item) => item.id)).toEqual(expected);
    expect(new Set(items.map((item) => item.id)).size).toBe(4);
  });
});

describe("acesso", () => {
  it("outra conta não lê o repertório nem as músicas particulares para imprimir", async () => {
    const { repertoire } = await mixedRepertoire();
    expect(await printFor(userB, repertoire.id, "chords")).toBeNull();

    const response = await repertoireRoute.GET(
      new Request(`${ORIGIN}/api/v1/library/repertoires/${repertoire.id}`, {
        headers: { cookie: userB.cookie, "x-repertorio-expected-user": userB.id },
      }),
      { params: Promise.resolve({ id: repertoire.id }) },
    );
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("Vinde");
  });
});

describe("link público", () => {
  async function shareOf(selection: ShareSelection) {
    const { repertoire, personal } = await mixedRepertoire();
    const shares = createLibraryService(userA.id).shares;
    const authorized = { authorizations: selection.authorizations.length ? [{ ...selection.authorizations[0]!, songId: personal.id }] : [] };
    const { contentHash } = await shares.preview(repertoire.id, authorized);
    const share = await shares.create(repertoire.id, { ...authorized, expectedHash: contentHash });
    return { share, token: share.path!.replace("/s/", ""), repertoire, shares };
  }

  const ALLOW: ShareSelection = { authorizations: [{ songId: "x", confirmed: true, declarationVersion: RIGHTS_DECLARATION_VERSION }] };

  it("imprime só o que foi autorizado ao publicar, na ordem e com os momentos publicados", async () => {
    const { token } = await shareOf(ALLOW);
    const result = await loadPublicShare(token);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    const items = buildSharePrint(result.share, "chords");
    expect(items.map(itemHeading)).toEqual([
      "Entrada: [TESTE] Hino",
      "Comunhão: [TESTE] Pão e Vinho",
      "Encerramento: [TESTE] Link",
      "Música 4: [TESTE] Ponte de Papel",
    ]);
    expect(items[0]).toMatchObject({ chordPro: HOSTED, printKey: "E" });
    // Catálogo sem permissão de redistribuição não entra no link, mesmo exibido na conta.
    expect(items.slice(1).map((item) => item.unavailable)).toEqual(["not-shared", "external-link", "not-shared"]);
    expect(JSON.stringify(result.share)).not.toContain("NOTA PRIVADA");
  });

  it("sem autorização da música particular, o link não traz a cifra para imprimir", async () => {
    const { token } = await shareOf({ authorizations: [] });
    const result = await loadPublicShare(token);
    if (result.status !== "ready") throw new Error("link indisponível");
    expect(buildSharePrint(result.share, "lyrics")[0]).toMatchObject({ unavailable: "not-shared" });
  });

  it("revogado, não há folha para imprimir", async () => {
    const { token, share, repertoire, shares } = await shareOf(ALLOW);
    await shares.revoke(repertoire.id, share.id);
    expect((await loadPublicShare(token)).status).toBe("unavailable");
  });
});
