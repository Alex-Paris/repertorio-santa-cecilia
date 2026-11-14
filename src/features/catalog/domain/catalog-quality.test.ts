import { describe, expect, it } from "vitest";

import { EMPTY_CLASSIFICATION_INPUT, type SongClassification } from "@/features/liturgy/domain/classification";

import { assessCatalogSong, assessReadiness, findContradictions, isRecommendable } from "./catalog-quality";

function liturgy(fields: Partial<SongClassification> = {}): SongClassification {
  return {
    ...EMPTY_CLASSIFICATION_INPUT,
    moments: ["comunhao"],
    editorialRationale: "Motivo",
    guidanceSource: "IGMR 86-87",
    classifiedBy: "admin",
    classifiedAt: "2026-11-14T00:00:00.000Z",
    reviewStatus: "reviewed",
    review: { by: "admin-2", at: "2026-11-14T00:00:00.000Z", source: "Hinário" },
    dispute: null,
    ...fields,
  };
}

const codes = (status: "published" | "draft", value: SongClassification | null) =>
  assessCatalogSong({ status, liturgy: value }).map((issue) => issue.code);

describe("qualidade da classificação", () => {
  it("música bem classificada não tem pendências", () => {
    expect(codes("published", liturgy())).toEqual([]);
  });

  it("sem classificação: aponta e, se publicada, avisa que não recebe sugestões", () => {
    expect(codes("published", null)).toEqual(["unclassified", "not-recommendable"]);
    expect(codes("draft", null)).toEqual(["unclassified"]);
  });

  it("sem momento litúrgico", () => {
    expect(codes("published", liturgy({ category: "devotional", moments: [] }))).toEqual(["no-moments", "not-recommendable"]);
    expect(codes("draft", liturgy({ moments: [] }))).toEqual(["no-moments"]);
  });

  it("sem justificativa editorial", () => {
    expect(codes("draft", liturgy({ editorialRationale: " " }))).toEqual(["no-rationale"]);
  });

  it("classificação incompleta aponta o que falta, sem repetir momento e justificativa", () => {
    expect(assessCatalogSong({ status: "draft", liturgy: liturgy({ guidanceSource: "" }) })).toEqual([
      { code: "incomplete", detail: "Falta: fonte de orientação." },
    ]);
    expect(codes("draft", liturgy({ category: "proper-text" }))).toEqual(["incomplete"]);
    expect(codes("draft", liturgy({ moments: ["salmo-responsorial"] }))).toEqual(["incomplete"]);
  });

  it("classificação automática ou importada não é conferida; divergência fica de fora das sugestões", () => {
    expect(codes("published", liturgy({ reviewStatus: "pending_review", review: null }))).toEqual(["unreviewed"]);
    expect(codes("published", liturgy({ reviewStatus: "disputed", review: null }))).toEqual([
      "disputed",
      "not-recommendable",
    ]);
    expect(isRecommendable({ status: "published", liturgy: liturgy({ reviewStatus: "pending_review", review: null }) })).toBe(
      true,
    );
    expect(isRecommendable({ status: "draft", liturgy: liturgy() })).toBe(false);
  });

  it("classificações contraditórias", () => {
    expect(findContradictions(liturgy({ seasons: ["quaresma"], avoidSeasons: ["quaresma"] }))).toEqual([
      "Indicada e restrita no mesmo tempo: Quaresma.",
    ]);
    expect(findContradictions(liturgy({ category: "general" }))).toEqual([
      "Canto que não é para a missa, mas com momentos da missa marcados.",
    ]);
    expect(findContradictions(liturgy())).toEqual([]);
    expect(codes("published", liturgy({ seasons: ["quaresma"], avoidSeasons: ["quaresma"] }))).toEqual([
      "contradictory",
      "not-recommendable",
    ]);
  });

  it("só aponta: a classificação avaliada não é alterada", () => {
    const value = liturgy({ category: "devotional", moments: [] });
    const before = structuredClone(value);
    assessCatalogSong({ status: "published", liturgy: value });
    expect(value).toEqual(before);
  });
});

describe("prontidão para recomendação", () => {
  it("separa as situações editoriais", () => {
    expect(assessReadiness(null)).toBe("unclassified");
    expect(assessReadiness(liturgy({ moments: [] }))).toBe("incomplete");
    expect(assessReadiness(liturgy({ seasons: ["quaresma"], avoidSeasons: ["quaresma"] }))).toBe("incomplete");
    expect(assessReadiness(liturgy({ reviewStatus: "pending_review", review: null }))).toBe("unreviewed");
    expect(assessReadiness(liturgy({ reviewStatus: "disputed" }))).toBe("disputed");
    expect(assessReadiness(liturgy({ category: "devotional", moments: [] }))).toBe("not-for-mass");
    expect(assessReadiness(liturgy())).toBe("ready");
  });
});

