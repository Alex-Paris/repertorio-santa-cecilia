import { describe, expect, it } from "vitest";

import {
  publishShareSchema,
  RIGHTS_DECLARATION_VERSION,
  shareSelectionSchema,
  updateShareSchema,
} from "./public-share";

const entry = { songId: "s1", confirmed: true, declarationVersion: RIGHTS_DECLARATION_VERSION };
const hash = "a".repeat(64);

describe("validação das entradas", () => {
  it("aceita uma autorização confirmada", () => {
    expect(shareSelectionSchema.safeParse({ authorizations: [entry] }).success).toBe(true);
  });

  it("aceita publicar sem nenhuma cifra", () => {
    expect(shareSelectionSchema.safeParse({ authorizations: [] }).success).toBe(true);
  });

  it("recusa autorização não confirmada", () => {
    expect(
      shareSelectionSchema.safeParse({ authorizations: [{ ...entry, confirmed: false }] }).success,
    ).toBe(false);
  });

  it("recusa uma versão antiga da declaração", () => {
    expect(
      shareSelectionSchema.safeParse({ authorizations: [{ ...entry, declarationVersion: "v0" }] }).success,
    ).toBe(false);
  });

  it("recusa músicas repetidas", () => {
    expect(shareSelectionSchema.safeParse({ authorizations: [entry, entry] }).success).toBe(false);
  });

  it("recusa campos extras, como ownerId ou o tipo da música", () => {
    expect(shareSelectionSchema.safeParse({ authorizations: [], ownerId: "x" }).success).toBe(false);
    expect(
      shareSelectionSchema.safeParse({ authorizations: [{ ...entry, contentType: "original" }] }).success,
    ).toBe(false);
  });

  it("exige o hash da prévia ao publicar", () => {
    expect(publishShareSchema.safeParse({ authorizations: [] }).success).toBe(false);
    expect(publishShareSchema.safeParse({ authorizations: [], expectedHash: "curto" }).success).toBe(false);
    expect(publishShareSchema.safeParse({ authorizations: [], expectedHash: hash }).success).toBe(true);
  });

  it("exige a revisão esperada ao atualizar", () => {
    expect(updateShareSchema.safeParse({ authorizations: [], expectedHash: hash }).success).toBe(false);
    expect(
      updateShareSchema.safeParse({ authorizations: [], expectedHash: hash, expectedRevision: 0 }).success,
    ).toBe(false);
    expect(
      updateShareSchema.safeParse({ authorizations: [], expectedHash: hash, expectedRevision: 1 }).success,
    ).toBe(true);
  });
});
