import { describe, expect, it } from "vitest";

import { createRepertoireItem, type Repertoire } from "../domain/repertoire";
import { getRepertoireNavigation } from "./repertoire-navigation";
import {
  getRepertoireSongHref,
  getSongEditHref,
  getSongReadingHref,
  parseRepertoireContextQuery,
  resolveRepertoireReadingContext,
} from "./repertoire-reading-context";

const repertoire: Repertoire = {
  revision: 1,
  id: "rep",
  name: "Repertório",
  description: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  // A ordem física é propositalmente diferente de `position`.
  items: [
    createRepertoireItem({ id: "c", songId: "song-c", position: 30 }),
    createRepertoireItem({ id: "a", songId: "song-a", position: 10 }),
    createRepertoireItem({ id: "b", songId: "song-b", position: 20 }),
  ],
};

describe("getRepertoireNavigation", () => {
  it("segue position, e não a ordem física do array", () => {
    const navigation = getRepertoireNavigation(repertoire, "b");
    expect(navigation?.position).toBe(2);
    expect(navigation?.total).toBe(3);
    expect(navigation?.previous?.id).toBe("a");
    expect(navigation?.next?.id).toBe("c");
  });

  it("não tem anterior na primeira música", () => {
    const navigation = getRepertoireNavigation(repertoire, "a");
    expect(navigation?.position).toBe(1);
    expect(navigation?.previous).toBeNull();
    expect(navigation?.next?.id).toBe("b");
  });

  it("não tem próxima na última música, sem voltar à primeira", () => {
    const navigation = getRepertoireNavigation(repertoire, "c");
    expect(navigation?.position).toBe(3);
    expect(navigation?.next).toBeNull();
    expect(navigation?.previous?.id).toBe("b");
  });

  it("retorna null para item fora do repertório", () => {
    expect(getRepertoireNavigation(repertoire, "x")).toBeNull();
  });
});

describe("links contextuais", () => {
  const context = { repertoire, item: repertoire.items[1] };

  it("codifica os identificadores na URL", () => {
    const href = getRepertoireSongHref("a&b=1", { id: "i d", songId: "s/1" });
    expect(href).toBe("/musicas/s%2F1?repertoireId=a%26b%3D1&itemId=i+d");
  });

  it("preserva o contexto validado na edição", () => {
    expect(getSongEditHref("song-a", context)).toBe(
      "/musicas/song-a/editar?repertoireId=rep&itemId=a",
    );
    expect(getSongReadingHref("song-a", context)).toBe(
      "/musicas/song-a?repertoireId=rep&itemId=a",
    );
  });

  it("volta à música normal quando não há contexto válido", () => {
    expect(getSongEditHref("song-a", null)).toBe("/musicas/song-a/editar");
    expect(getSongReadingHref("song-a", null)).toBe("/musicas/song-a");
  });

  it("ignora parâmetros repetidos ou ausentes na URL", () => {
    expect(parseRepertoireContextQuery({})).toBeUndefined();
    expect(parseRepertoireContextQuery({ repertoireId: "r" })).toBeUndefined();
    expect(parseRepertoireContextQuery({ repertoireId: ["r", "s"], itemId: "i" })).toBeUndefined();
    expect(parseRepertoireContextQuery({ repertoireId: "r", itemId: "i" })).toEqual({
      repertoireId: "r",
      itemId: "i",
    });
  });

  it("rejeita item que não pertence à música", () => {
    expect(
      resolveRepertoireReadingContext([repertoire], "song-b", { repertoireId: "rep", itemId: "a" }),
    ).toBeNull();
  });
});
