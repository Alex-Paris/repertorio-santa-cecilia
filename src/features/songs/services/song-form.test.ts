import { describe, expect, it } from "vitest";

import { demoSongs } from "../data/demo-songs";
import { EMPTY_SONG_FORM, parseSongForm, songToFormValues } from "./song-form";

const filled = { ...EMPTY_SONG_FORM, title: "Título", artist: "Artista" };
const external = { ...filled, contentType: "external-link" as const };

describe("parseSongForm", () => {
  it("exige título e artista, com mensagens em português", () => {
    expect(parseSongForm(EMPTY_SONG_FORM)).toEqual({
      success: false,
      errors: { title: "Informe o título.", artist: "Informe o artista." },
    });
  });

  it("recusa campos só com espaços e remove espaços das pontas", () => {
    expect(parseSongForm({ ...filled, title: "   " }).success).toBe(false);
    expect(parseSongForm({ ...filled, title: "  Título  " })).toMatchObject({
      success: true,
      input: { title: "Título" },
    });
  });

  it("omite a cifra vazia em vez de guardar texto vazio", () => {
    const result = parseSongForm({ ...filled, chordPro: "  \n " });
    expect(result.success && result.input).not.toHaveProperty("chordPro");
  });

  it("preserva a cifra exatamente como digitada", () => {
    const chordPro = "  {title: X}\n\n[G]Letra   com  espaços\n";
    expect(parseSongForm({ ...filled, chordPro })).toMatchObject({ input: { chordPro } });
  });

  it("não guarda sourceUrl em música própria ou autorizada", () => {
    const result = parseSongForm({ ...filled, contentType: "authorized", sourceUrl: "https://a.com" });
    expect(result.success && result.input).not.toHaveProperty("sourceUrl");
  });

  it("não guarda cifra em link externo", () => {
    const result = parseSongForm({ ...external, sourceUrl: "https://a.com", chordPro: "[G]x" });
    expect(result.success && result.input).not.toHaveProperty("chordPro");
  });
});

describe("validação de URL externa", () => {
  it("exige o link em músicas do tipo link externo", () => {
    expect(parseSongForm(external)).toEqual({
      success: false,
      errors: { sourceUrl: "Informe o link da fonte original." },
    });
  });

  it.each(["https://example.com/cifra", "http://example.com"])("aceita %s", (sourceUrl) => {
    expect(parseSongForm({ ...external, sourceUrl }).success).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>1</script>",
    "ftp://example.com",
    "example.com",
  ])("recusa %s", (sourceUrl) => {
    expect(parseSongForm({ ...external, sourceUrl })).toEqual({
      success: false,
      errors: { sourceUrl: "Use um link completo, começando com http:// ou https://." },
    });
  });
});

describe("songToFormValues", () => {
  it("permite reabrir no formulário as músicas existentes", () => {
    demoSongs.forEach((song) => {
      expect(parseSongForm(songToFormValues(song)).success).toBe(true);
    });
  });
});
