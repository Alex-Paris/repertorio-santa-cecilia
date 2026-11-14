import { describe, expect, it } from "vitest";

import {
  EMPTY_CLASSIFICATION_INPUT,
  classificationReviewRequestSchema,
  missingClassificationParts,
  nextClassificationStatus,
  publicSongClassificationSchema,
  songClassificationInputSchema,
  toPublicClassification,
  type SongClassification,
  type SongClassificationInput,
} from "./classification";
import {
  BIBLE_BOOKS,
  formatScriptureReference,
  scriptureOverlaps,
  scriptureReferenceSchema,
} from "./scripture";
import { LITURGICAL_MOMENTS, isMassCategory, momentOrder } from "./vocabulary";

const base: SongClassificationInput = {
  ...EMPTY_CLASSIFICATION_INPUT,
  moments: ["comunhao"],
  editorialRationale: "Texto eucarístico.",
  guidanceSource: "IGMR 86-87",
};

const saved = (input: Partial<SongClassification> = {}): SongClassification => ({
  ...base,
  classifiedBy: "admin-1",
  classifiedAt: "2026-11-11T00:00:00.000Z",
  reviewStatus: "pending_review",
  review: null,
  dispute: null,
  ...input,
});

const issues = (input: unknown): string[] => {
  const result = songClassificationInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("vocabulários", () => {
  it("os momentos seguem a ordem da missa", () => {
    expect(LITURGICAL_MOMENTS[0].id).toBe("entrada");
    expect(LITURGICAL_MOMENTS.at(-1)?.id).toBe("encerramento");
    expect(momentOrder("entrada")).toBeLessThan(momentOrder("comunhao"));
    expect(momentOrder(undefined)).toBe(LITURGICAL_MOMENTS.length);
  });

  it("distingue o canto que é o rito do canto que acompanha o rito", () => {
    const kind = (id: string) => LITURGICAL_MOMENTS.find((moment) => moment.id === id)?.kind;
    expect(kind("gloria")).toBe("rite");
    expect(kind("santo")).toBe("rite");
    expect(kind("entrada")).toBe("accompanies");
    expect(kind("comunhao")).toBe("accompanies");
    expect(kind("encerramento")).toBe("optional");
  });

  it("só canto litúrgico e texto próprio servem à missa", () => {
    expect(isMassCategory("liturgical")).toBe(true);
    expect(isMassCategory("proper-text")).toBe(true);
    expect(isMassCategory("devotional")).toBe(false);
    expect(isMassCategory("general")).toBe(false);
  });
});

describe("referências bíblicas", () => {
  it("cobre os 73 livros do cânon católico, sem repetição", () => {
    expect(BIBLE_BOOKS).toHaveLength(73);
    expect(new Set(BIBLE_BOOKS.map(([id]) => id)).size).toBe(73);
  });

  it("formata como os lecionários do Brasil", () => {
    expect(formatScriptureReference({ book: "jo", chapter: 6, verseStart: 51, verseEnd: 58 })).toBe("Jo 6,51-58");
    expect(formatScriptureReference({ book: "mt", chapter: 25 })).toBe("Mt 25");
    expect(formatScriptureReference({ book: "lc", chapter: 1, verseStart: 46 })).toBe("Lc 1,46");
  });

  it("mostra as duas numerações dos salmos", () => {
    expect(formatScriptureReference({ book: "sl", chapter: 23 })).toBe("Sl 22(23)");
    expect(formatScriptureReference({ book: "sl", chapter: 128, verseStart: 1, verseEnd: 5 })).toBe("Sl 127(128),1-5");
    // Onde a correspondência não é simples, fica só a numeração hebraica.
    expect(formatScriptureReference({ book: "sl", chapter: 8 })).toBe("Sl 8");
    expect(formatScriptureReference({ book: "sl", chapter: 116 })).toBe("Sl 116");
  });

  it("compara trechos pela estrutura, não por texto", () => {
    const gospel = { book: "mt", chapter: 25, verseStart: 31, verseEnd: 46 } as const;
    expect(scriptureOverlaps(gospel, { book: "mt", chapter: 25, verseStart: 40, verseEnd: 41 })).toBe(true);
    expect(scriptureOverlaps(gospel, { book: "mt", chapter: 25 })).toBe(true);
    expect(scriptureOverlaps(gospel, { book: "mt", chapter: 25, verseStart: 14, verseEnd: 30 })).toBe(false);
    expect(scriptureOverlaps(gospel, { book: "mt", chapter: 24, verseStart: 31, verseEnd: 46 })).toBe(false);
    expect(scriptureOverlaps(gospel, { book: "mc", chapter: 25 })).toBe(false);
  });

  it("recusa livros desconhecidos e versículos incoerentes", () => {
    expect(scriptureReferenceSchema.safeParse({ book: "xx", chapter: 1 }).success).toBe(false);
    expect(scriptureReferenceSchema.safeParse({ book: "jo", chapter: 0 }).success).toBe(false);
    expect(scriptureReferenceSchema.safeParse({ book: "jo", chapter: 3, verseEnd: 5 }).success).toBe(false);
    expect(scriptureReferenceSchema.safeParse({ book: "jo", chapter: 3, verseStart: 9, verseEnd: 5 }).success).toBe(false);
    expect(scriptureReferenceSchema.safeParse({ book: "jo", chapter: 3, texto: "livre" }).success).toBe(false);
  });
});

describe("classificação de uma música", () => {
  it("aceita vários momentos, tempos, celebrações, temas e referências ao mesmo tempo", () => {
    const result = songClassificationInputSchema.safeParse({
      ...base,
      moments: ["entrada", "comunhao", "acao-de-gracas"],
      seasons: ["advento", "natal"],
      celebrations: ["cristo-rei", "sagrado-coracao"],
      themes: ["eucaristia", "misericordia", "bom-pastor"],
      scripture: [
        { book: "sl", chapter: 23 },
        { book: "jo", chapter: 10, verseStart: 11, verseEnd: 18 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("recusa valores fora dos vocabulários e repetidos", () => {
    expect(issues({ ...base, moments: ["ofertorio-inventado"] })).not.toEqual([]);
    expect(issues({ ...base, themes: ["tema-livre"] })).not.toEqual([]);
    expect(issues({ ...base, moments: ["comunhao", "comunhao"] })).toContain("Há itens repetidos.");
    expect(issues({ ...base, scripture: [{ book: "sl", chapter: 23 }, { book: "sl", chapter: 23 }] })).toContain(
      "Há referências bíblicas repetidas.",
    );
    expect(issues({ ...base, extra: true })).not.toEqual([]);
  });

  it("canto devocional ou de uso geral não é indicado para momentos da missa", () => {
    expect(issues({ ...base, category: "devotional" })).toContain(
      "Só cantos litúrgicos podem ser indicados para momentos da missa.",
    );
    expect(issues({ ...base, category: "general", moments: [] })).toEqual([]);
  });

  it("canto litúrgico sem momento pode ser salvo, mas fica incompleto", () => {
    expect(issues({ ...base, moments: [] })).toEqual([]);
    expect(missingClassificationParts({ ...base, moments: [] })).toEqual(["momento da missa"]);
  });

  it("texto próprio sem a celebração ou a passagem a que pertence fica incompleto", () => {
    expect(issues({ ...base, category: "proper-text" })).toEqual([]);
    expect(missingClassificationParts({ ...base, category: "proper-text" })).toContain(
      "celebração ou passagem a que o texto próprio pertence",
    );
    expect(missingClassificationParts({ ...base, category: "proper-text", celebrations: ["pentecostes"] })).toEqual([]);
  });

  it("salmo responsorial precisa da referência bíblica para ficar completo", () => {
    expect(missingClassificationParts({ ...base, moments: ["salmo-responsorial"] })).toEqual(["referência bíblica do salmo"]);
  });

  it("canto devocional sem momentos está completo com justificativa e fonte", () => {
    expect(missingClassificationParts({ ...base, category: "devotional", moments: [] })).toEqual([]);
  });

  it("o mesmo tempo não pode ser indicado e restrito", () => {
    expect(issues({ ...base, seasons: ["quaresma"], avoidSeasons: ["quaresma"] })).toContain(
      "O mesmo tempo não pode ser indicado e restrito.",
    );
  });

  it("justificativa e fonte de orientação ausentes não impedem o rascunho, mas deixam a classificação incompleta", () => {
    const draft = { ...base, editorialRationale: "  ", guidanceSource: "" };
    expect(issues(draft)).toEqual([]);
    expect(missingClassificationParts(draft)).toEqual(["justificativa editorial", "fonte de orientação"]);
  });

  it("a projeção pública não leva a justificativa nem quem classificou", () => {
    const view = toPublicClassification(saved({ editorialRationale: "INTERNA" }));

    expect(JSON.stringify(view)).not.toContain("INTERNA");
    expect(view).not.toHaveProperty("classifiedBy");
    expect(publicSongClassificationSchema.safeParse(view).success).toBe(true);
    expect(publicSongClassificationSchema.safeParse({ ...view, editorialRationale: "x" }).success).toBe(false);
  });
});

describe("conferência humana da classificação", () => {
  const approve = { action: "approve", humanReviewConfirmed: true, source: "Hinário Litúrgico da CNBB" } as const;

  it("exige a confirmação pessoal e a fonte consultada", () => {
    expect(classificationReviewRequestSchema.safeParse({ action: "approve", source: "x" }).success).toBe(false);
    expect(classificationReviewRequestSchema.safeParse({ ...approve, source: " " }).success).toBe(false);
    expect(classificationReviewRequestSchema.safeParse(approve).success).toBe(true);
    expect(classificationReviewRequestSchema.safeParse({ action: "dispute", note: "" }).success).toBe(false);
  });

  it("só confere classificação completa", () => {
    expect(nextClassificationStatus(saved(), approve)).toEqual({ ok: true, status: "reviewed" });
    const incomplete = nextClassificationStatus(saved({ guidanceSource: "" }), approve);
    expect(incomplete).toEqual({ ok: false, message: "A classificação está incompleta: falta fonte de orientação." });
  });

  it("divergência precisa ser resolvida antes da conferência", () => {
    const disputed = saved({ reviewStatus: "disputed" });
    expect(nextClassificationStatus(disputed, approve).ok).toBe(false);
    expect(nextClassificationStatus(disputed, { action: "dispute", note: "x" }).ok).toBe(false);
    expect(nextClassificationStatus(disputed, { action: "resolve", note: "Conferido no hinário." })).toEqual({
      ok: true,
      status: "pending_review",
    });
    expect(nextClassificationStatus(saved(), { action: "resolve", note: "x" }).ok).toBe(false);
    expect(nextClassificationStatus(saved(), { action: "dispute", note: "Momento discutível." })).toEqual({
      ok: true,
      status: "disputed",
    });
  });

  it("a projeção pública mostra a conferência só quando houve, sem quem conferiu", () => {
    const reviewed = toPublicClassification(
      saved({ reviewStatus: "reviewed", review: { by: "admin-2", at: "2026-11-12T00:00:00.000Z", source: "IGMR" } }),
    );
    expect(reviewed.review).toEqual({ at: "2026-11-12T00:00:00.000Z", source: "IGMR" });
    expect(JSON.stringify(reviewed)).not.toContain("admin-2");
    expect(toPublicClassification(saved()).review).toBeUndefined();
    expect(toPublicClassification(saved()).reviewStatus).toBe("pending_review");
  });
});

