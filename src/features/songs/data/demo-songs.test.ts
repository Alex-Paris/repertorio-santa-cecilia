import { describe, expect, it } from "vitest";

import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";

import { demoSongs } from "./demo-songs";

describe("dados demonstrativos", () => {
  it("têm entre 5 e 8 músicas com IDs únicos", () => {
    expect(demoSongs.length).toBeGreaterThanOrEqual(5);
    expect(demoSongs.length).toBeLessThanOrEqual(8);
    expect(new Set(demoSongs.map((song) => song.id)).size).toBe(demoSongs.length);
  });

  it("incluem música external-link sem cifra copiada", () => {
    const externalSongs = demoSongs.filter((song) => song.contentType === "external-link");
    expect(externalSongs.length).toBeGreaterThanOrEqual(1);
    externalSongs.forEach((song) => expect(song.chordPro).toBeUndefined());
  });

  it("têm 2 repertórios que referenciam apenas músicas existentes", () => {
    const songIds = new Set(demoSongs.map((song) => song.id));
    expect(demoRepertoires).toHaveLength(2);
    demoRepertoires
      .flatMap((repertoire) => repertoire.items)
      .forEach((item) => expect(songIds.has(item.songId)).toBe(true));
  });

  it("permitem a mesma música em repertórios diferentes com tons próprios", () => {
    const occurrences = demoRepertoires
      .flatMap((repertoire) => repertoire.items)
      .filter((item) => item.songId === "song-coracao-de-vento");
    expect(new Set(occurrences.map((item) => item.transposeSemitones)).size).toBe(2);
  });
});
