// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readExpectedRevision, withETag } from "./revision";

function withIfMatch(value?: string): Request {
  return new Request("http://localhost/api", value === undefined ? {} : { headers: { "If-Match": value } });
}

describe("precondição de revisão", () => {
  it("lê a revisão de uma ETag forte", () => {
    expect(readExpectedRevision(withIfMatch('"3"'))).toBe(3);
  });

  it.each([undefined, "", "*", 'W/"3"', '"0"', '"-1"', "3", '"3", "4"', '"abc"', '"1.5"'])(
    "recusa precondição ausente ou inválida: %s",
    (value) => {
      expect(() => readExpectedRevision(withIfMatch(value))).toThrow(
        expect.objectContaining({ code: "revision-required" }),
      );
    },
  );

  it("anuncia a revisão atual como ETag", () => {
    expect(withETag(new Response(null), 7).headers.get("ETag")).toBe('"7"');
  });
});
