// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isSignUpEnabled } from "./sign-up-policy";

describe("isSignUpEnabled", () => {
  it.each(["development", "test"])("permite em %s com autorização explícita", (nodeEnv) => {
    expect(isSignUpEnabled(nodeEnv, "true")).toBe(true);
  });

  it.each([undefined, "false", "1", ""])("recusa em desenvolvimento com flag %j", (flag) => {
    expect(isSignUpEnabled("development", flag)).toBe(false);
  });

  it("nunca permite em produção, mesmo com a flag", () => {
    expect(isSignUpEnabled("production", "true")).toBe(false);
  });

  it.each([undefined, "", "staging"])("recusa em ambiente desconhecido %j", (nodeEnv) => {
    expect(isSignUpEnabled(nodeEnv, "true")).toBe(false);
  });
});
