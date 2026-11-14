import { describe, expect, it } from "vitest";

import { isSafeExternalUrl } from "./is-safe-external-url";

describe("isSafeExternalUrl", () => {
  it("aceita http e https", () => {
    expect(isSafeExternalUrl("https://example.com/a")).toBe(true);
    expect(isSafeExternalUrl("http://example.com")).toBe(true);
  });

  it("rejeita outros esquemas e textos que não são URLs", () => {
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("data:text/html,x")).toBe(false);
    expect(isSafeExternalUrl("não é url")).toBe(false);
  });
});
