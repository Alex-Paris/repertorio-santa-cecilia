import { describe, expect, it } from "vitest";

import { transposeKey } from "./transposition";

describe("transposeKey", () => {
  it("desloca tons maiores e menores", () => {
    expect(transposeKey("G", 2)).toBe("A");
    expect(transposeKey("Am", 3)).toBe("Cm");
  });

  it("aceita deslocamentos negativos e maiores que uma oitava", () => {
    expect(transposeKey("D", -2)).toBe("C");
    expect(transposeKey("C", -1)).toBe("B");
    expect(transposeKey("C", 14)).toBe("D");
  });

  it("mantém o tom com deslocamento zero", () => {
    expect(transposeKey("Bb", 0)).toBe("Bb");
  });
});
