import { describe, expect, it } from "vitest";

import { celebrationInputSchema, computeProvenance } from "../domain/celebration-record";
import { CELEBRATION_PRESETS } from "./celebration-presets";

describe("preenchimento preparado das celebrações", () => {
  it("oferece somente conteúdo validado, sem aprovação nem campos de controle", () => {
    for (const preset of CELEBRATION_PRESETS) {
      expect(celebrationInputSchema.safeParse(preset.input).success).toBe(true);
      expect(preset.input).not.toHaveProperty("approval");
      expect(preset.input).not.toHaveProperty("reviewStatus");
      expect(preset.input).not.toHaveProperty("revision");
    }
    expect(new Set(CELEBRATION_PRESETS.map((entry) => entry.id)).size).toBe(CELEBRATION_PRESETS.length);
  });

  it("30 de novembro usa o próprio de Santo André e preserva a proveniência e as ressalvas", () => {
    const input = CELEBRATION_PRESETS.find((entry) => entry.input.date === "2026-11-30")!.input;
    expect(input).toMatchObject({
      title: "Santo André, Apóstolo", rank: "festa", season: "advento",
      readings: [
        { role: "first", citation: "Rm 10,9-18" },
        { role: "psalm", citation: "Sl 18(19A),2-3.4-5 (R. 5a)", ranges: [{ book: "sl", chapter: 19, verseStart: 2, verseEnd: 5 }] },
        { role: "gospel", citation: "Mt 4,18-22" },
      ],
    });
    const provenance = computeProvenance(input);
    expect(provenance.find((entry) => entry.field === "title")).toMatchObject({ status: "source", sourceIds: ["vatican-news"] });
    expect(provenance.find((entry) => entry.field === "psalm")).toMatchObject({ status: "source", sourceIds: ["liturgia-portugal"] });
    for (const field of ["color", "cycle", "season"]) {
      expect(provenance.find((entry) => entry.field === field)?.status).toBe("inference");
    }
    expect(input.notes.join(" ")).toContain("Lecionário brasileiro");
    expect(input.sources.every((source) => source.verificationStatus === "automated-comparison")).toBe(true);
  });

  it("não reaproveita leituras de outro ano ou de datas sem cobertura", () => {
    expect(CELEBRATION_PRESETS.find((entry) => entry.input.date === "2027-11-30")).toBeUndefined();
    expect(CELEBRATION_PRESETS.find((entry) => entry.input.date === "2026-11-28")).toBeUndefined();
  });
});
