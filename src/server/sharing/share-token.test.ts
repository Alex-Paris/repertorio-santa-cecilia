// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  createShareToken,
  generateShareId,
  getSharePath,
  parseShareToken,
  verifyShareSignature,
} from "./share-token";

const SECRET = "chave-de-teste-com-mais-de-32-caracteres";

function parsed(token: string) {
  const result = parseShareToken(token);
  if (!result) {
    throw new Error("token deveria ser válido");
  }
  return result;
}

describe("links públicos", () => {
  it("gera identificadores imprevisíveis e sem repetição", () => {
    const ids = Array.from({ length: 500 }, generateShareId);

    expect(new Set(ids).size).toBe(500);
    expect(ids.every((id) => /^[\w-]{22}$/.test(id))).toBe(true);
  });

  it("monta a URL no formato /s/<id>.<assinatura>", () => {
    const token = createShareToken(SECRET, generateShareId(), 1);

    expect(getSharePath(token)).toMatch(/^\/s\/[\w-]{22}\.[\w-]{43}$/);
  });

  it("gera sempre o mesmo link para a mesma publicação, sem guardar segredo", () => {
    const id = generateShareId();

    expect(createShareToken(SECRET, id, 1)).toBe(createShareToken(SECRET, id, 1));
  });

  it("aceita uma assinatura correta", () => {
    const id = generateShareId();

    expect(verifyShareSignature(SECRET, parsed(createShareToken(SECRET, id, 1)), 1)).toBe(true);
  });

  it("recusa um token de versão anterior, como após revogação", () => {
    const id = generateShareId();

    expect(verifyShareSignature(SECRET, parsed(createShareToken(SECRET, id, 1)), 2)).toBe(false);
  });

  it("recusa assinatura feita com outra chave", () => {
    const id = generateShareId();
    const token = createShareToken("outra-chave-de-teste-com-32-caracteres", id, 1);

    expect(verifyShareSignature(SECRET, parsed(token), 1)).toBe(false);
  });

  it("recusa a assinatura de outra publicação", () => {
    const signature = parsed(createShareToken(SECRET, generateShareId(), 1)).signature;

    expect(verifyShareSignature(SECRET, { shareId: generateShareId(), signature }, 1)).toBe(false);
  });

  it("recusa uma assinatura adulterada", () => {
    const token = createShareToken(SECRET, generateShareId(), 1);
    const last = token.at(-1) === "A" ? "B" : "A";

    expect(verifyShareSignature(SECRET, parsed(`${token.slice(0, -1)}${last}`), 1)).toBe(false);
  });

  it.each([
    "",
    "abc",
    "abc.def",
    "../../etc/passwd",
    `${"a".repeat(22)}.${"b".repeat(42)}`,
    `${"a".repeat(23)}.${"b".repeat(43)}`,
    `${"a".repeat(22)}.${"b".repeat(43)}.x`,
    `${"a".repeat(21)}$.${"b".repeat(43)}`,
    { $ne: null },
    null,
  ])("recusa pelo formato: %s", (token) => {
    expect(parseShareToken(token)).toBeNull();
  });
});
