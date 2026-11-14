import { describe, expect, it } from "vitest";

import { editorialContext, reviewedContext } from "@/test/liturgy-fixtures";

import type { LiturgicalCelebrationContext } from "./calendar";
import { EMPTY_CLASSIFICATION_INPUT, type PublicSongClassification } from "./classification";
import {
  checkEligibility,
  diagnoseCelebration,
  recommendForCelebration,
  usableReadings,
  suggestForCelebration,
  suggestForMoment,
  type SuggestionCandidate,
} from "./recommendation";
import { getMomentGuidance, isAlleluiaSung, isGloriaSung } from "./rubrics";

const celebration = (date: string): LiturgicalCelebrationContext => editorialContext(date);

const ORDINARY = celebration("2026-11-15");
const CHRIST_THE_KING = celebration("2026-11-22");
const ADVENT = celebration("2026-11-29");
const LENT: LiturgicalCelebrationContext = { ...ORDINARY, season: "quaresma", rank: "domingo", celebrations: [] };

const { editorialRationale: _internal, ...PUBLIC_EMPTY } = EMPTY_CLASSIFICATION_INPUT;
void _internal;

function classification(fields: Partial<PublicSongClassification>): PublicSongClassification {
  return { ...PUBLIC_EMPTY, moments: ["comunhao"], ...fields };
}

function candidate(id: string, fields: Partial<PublicSongClassification>, title = id): SuggestionCandidate {
  return {
    id,
    title,
    artist: "Grupo Fictício",
    originalKey: "C",
    contentType: "original",
    hasChordPro: true,
    liturgy: classification(fields),
  };
}

const ids = (context: LiturgicalCelebrationContext, candidates: SuggestionCandidate[], moment = "comunhao" as const) =>
  suggestForMoment(context, moment, candidates, 24).suggestions.map((entry) => entry.song.id);

describe("normas por tempo e grau", () => {
  it("Glória: domingos fora do Advento e da Quaresma, solenidades e festas", () => {
    expect(isGloriaSung({ season: "tempo-comum", rank: "domingo" })).toBe(true);
    expect(isGloriaSung({ season: "advento", rank: "domingo" })).toBe(false);
    expect(isGloriaSung({ season: "quaresma", rank: "domingo" })).toBe(false);
    expect(isGloriaSung({ season: "advento", rank: "solenidade" })).toBe(true);
    expect(isGloriaSung({ season: "quaresma", rank: "festa" })).toBe(true);
    expect(isGloriaSung({ season: "tempo-comum", rank: "feria" })).toBe(false);
  });

  it("Aleluia: em todos os tempos, menos na Quaresma", () => {
    expect(isAlleluiaSung({ season: "pascoa", rank: "domingo" })).toBe(true);
    expect(isAlleluiaSung({ season: "quaresma", rank: "domingo" })).toBe(false);
  });

  it("explica a orientação e cita a Instrução Geral", () => {
    expect(getMomentGuidance(ADVENT, "gloria")).toMatchObject({
      status: "omitted",
      igmr: "53",
      note: "O Glória não é cantado nos domingos do Advento e da Quaresma.",
    });
    expect(getMomentGuidance(LENT, "aclamacao-ao-evangelho").note).toContain("não se canta o Aleluia");
    expect(getMomentGuidance(ORDINARY, "salmo-responsorial").note).toContain("Sl 127(128)");
    expect(getMomentGuidance(celebration("2026-12-20"), "salmo-responsorial").note).toContain("ainda não foi conferido");
    expect(getMomentGuidance(ORDINARY, "encerramento").igmr).toBeNull();
  });
});

describe("restrições antes da ordenação", () => {
  it("música elegível: canto litúrgico indicado para o momento", () => {
    expect(checkEligibility(ORDINARY, "comunhao", classification({}))).toEqual({ eligible: true });
  });

  it("música de outro momento é incompatível", () => {
    expect(checkEligibility(ORDINARY, "entrada", classification({}))).toEqual({ eligible: false, rule: "other-moment" });
  });

  it("canto devocional ou de uso geral não é sugerido para a missa", () => {
    for (const category of ["devotional", "general"] as const) {
      expect(checkEligibility(ORDINARY, "comunhao", classification({ category }))).toEqual({
        eligible: false,
        rule: "not-for-mass",
      });
    }
  });

  it("Glória não é sugerido nos domingos do Advento e da Quaresma", () => {
    const gloria = classification({ moments: ["gloria"] });
    expect(checkEligibility(ORDINARY, "gloria", gloria).eligible).toBe(true);
    expect(checkEligibility(ADVENT, "gloria", gloria)).toEqual({ eligible: false, rule: "moment-omitted" });
    expect(checkEligibility(LENT, "gloria", gloria)).toEqual({ eligible: false, rule: "moment-omitted" });
  });

  it("uma aclamação com Aleluia não aparece na Quaresma", () => {
    const alleluia = classification({ moments: ["aclamacao-ao-evangelho"], avoidSeasons: ["quaresma"] });
    expect(checkEligibility(ORDINARY, "aclamacao-ao-evangelho", alleluia).eligible).toBe(true);
    expect(checkEligibility(LENT, "aclamacao-ao-evangelho", alleluia)).toEqual({
      eligible: false,
      rule: "season-restricted",
    });
  });

  it("música própria de um tempo só aparece nele", () => {
    const lenten = classification({ seasons: ["quaresma"] });
    expect(checkEligibility(LENT, "comunhao", lenten).eligible).toBe(true);
    expect(checkEligibility(ORDINARY, "comunhao", lenten)).toEqual({
      eligible: false,
      rule: "other-season-or-celebration",
    });
  });

  it("música própria de uma celebração só aparece nela", () => {
    const pentecost = classification({ celebrations: ["pentecostes"] });
    const king = classification({ celebrations: ["cristo-rei"] });
    expect(checkEligibility(CHRIST_THE_KING, "comunhao", pentecost).eligible).toBe(false);
    expect(checkEligibility(CHRIST_THE_KING, "comunhao", king).eligible).toBe(true);
  });

  it("texto próprio exige a celebração ou a leitura correspondente", () => {
    const proper = classification({
      category: "proper-text",
      scripture: [{ book: "mt", chapter: 25, verseStart: 31, verseEnd: 46 }],
    });
    expect(checkEligibility(CHRIST_THE_KING, "comunhao", proper).eligible).toBe(true);
    expect(checkEligibility(ORDINARY, "comunhao", proper)).toEqual({ eligible: false, rule: "proper-text-elsewhere" });
  });

  it("o salmo responsorial precisa ser o do Lecionário", () => {
    const psalm23 = classification({ moments: ["salmo-responsorial"], scripture: [{ book: "sl", chapter: 23 }] });
    const psalm51 = classification({ moments: ["salmo-responsorial"], scripture: [{ book: "sl", chapter: 51 }] });
    const noReference = classification({ moments: ["salmo-responsorial"] });

    expect(checkEligibility(CHRIST_THE_KING, "salmo-responsorial", psalm23).eligible).toBe(true);
    expect(checkEligibility(CHRIST_THE_KING, "salmo-responsorial", psalm51)).toEqual({
      eligible: false,
      rule: "psalm-not-of-the-day",
    });
    expect(checkEligibility(CHRIST_THE_KING, "salmo-responsorial", noReference).eligible).toBe(false);
    // Sem salmo conferido na base, nada é sugerido: o texto não é presumido.
    expect(checkEligibility(celebration("2026-12-20"), "salmo-responsorial", psalm23).eligible).toBe(false);
  });

  it("muitos temas em comum não tornam elegível uma música inadequada", () => {
    const manyThemes = candidate("devocional", {
      category: "devotional",
      moments: [],
      themes: ["reino-de-deus", "bom-pastor", "caridade"],
    });
    const wrongSeason = candidate("pascal", { seasons: ["pascoa"], themes: ["reino-de-deus", "bom-pastor", "caridade"] });
    const plain = candidate("simples", {});

    expect(ids(CHRIST_THE_KING, [manyThemes, wrongSeason, plain])).toEqual(["simples"]);
  });
});

describe("ordem das sugestões", () => {
  const byCelebration = candidate("celebracao", { celebrations: ["cristo-rei"] }, "Zênite");
  const byReading = candidate("leitura", { scripture: [{ book: "mt", chapter: 25, verseStart: 31, verseEnd: 46 }] }, "Yara");
  const bySeason = candidate("tempo", { seasons: ["tempo-comum"] }, "Xote");
  const byThemes = candidate("temas", { themes: ["reino-de-deus", "caridade"] }, "Valsa");
  const byOneTheme = candidate("tema", { themes: ["caridade"] }, "Uirapuru");
  const onlyMoment = candidate("momento", {}, "Abertura");

  it("prioriza celebração, depois leituras, tempo e temas", () => {
    const shuffled = [onlyMoment, byOneTheme, bySeason, byThemes, byReading, byCelebration];
    expect(ids(CHRIST_THE_KING, shuffled)).toEqual(["celebracao", "leitura", "tempo", "temas", "tema", "momento"]);
  });

  it("é determinístico: a ordem de chegada não muda o resultado", () => {
    const candidates = [onlyMoment, byOneTheme, bySeason, byThemes, byReading, byCelebration];
    expect(ids(CHRIST_THE_KING, [...candidates].reverse())).toEqual(ids(CHRIST_THE_KING, candidates));
  });

  it("empate é resolvido pelo título e, depois, pelo ID", () => {
    const b = candidate("b", {}, "Mesmo Título");
    const a = candidate("a", {}, "Mesmo Título");
    const first = candidate("z", {}, "Abre");
    expect(ids(ORDINARY, [b, a, first])).toEqual(["z", "a", "b"]);
  });

  it("o momento litúrgico vem antes de qualquer outra afinidade", () => {
    const entranceWithEverything = candidate("entrada-forte", {
      moments: ["entrada"],
      celebrations: ["cristo-rei"],
      seasons: ["tempo-comum"],
      themes: ["reino-de-deus", "bom-pastor", "caridade"],
    });
    expect(ids(CHRIST_THE_KING, [entranceWithEverything, onlyMoment])).toEqual(["momento"]);
  });

  it("limita a lista e informa quantas são elegíveis", () => {
    const many = Array.from({ length: 9 }, (_, index) => candidate(`m${index}`, {}, `Canto ${index}`));
    const result = suggestForMoment(ORDINARY, "comunhao", many, 4);
    expect(result.suggestions).toHaveLength(4);
    expect(result.total).toBe(9);
  });
});

describe("justificativas", () => {
  it("vêm só da classificação cadastrada", () => {
    const [suggestion] = suggestForMoment(
      CHRIST_THE_KING,
      "comunhao",
      [
        candidate("rei", {
          celebrations: ["cristo-rei"],
          seasons: ["tempo-comum"],
          themes: ["bom-pastor", "misericordia"],
          scripture: [{ book: "sl", chapter: 23 }],
        }),
      ],
      1,
    ).suggestions;

    expect(suggestion.reasons).toEqual([
      { criterion: "moment", text: "Adequada à Comunhão" },
      { criterion: "celebration", text: "Associada à celebração: Cristo Rei" },
      { criterion: "reading", text: "Relacionada ao salmo responsorial (Sl 22(23),1-2a.2b-3.5-6)" },
      { criterion: "season", text: "Indicada para o Tempo Comum" },
      { criterion: "theme", text: "Relacionada ao tema: bom pastor" },
    ]);
    // "misericórdia" está na música, mas não na celebração: não vira justificativa.
    expect(JSON.stringify(suggestion.reasons)).not.toContain("misericórdia");
  });

  it("sem outras afinidades, a justificativa é só o momento", () => {
    const [suggestion] = suggestForMoment(ADVENT, "entrada", [candidate("x", { moments: ["entrada"] })]).suggestions;
    expect(suggestion.reasons).toEqual([{ criterion: "moment", text: "Adequada à Entrada" }]);
  });

  it("distingue sugestão editorial de indicação com fonte oficial", () => {
    const [editorial, official] = suggestForMoment(
      ORDINARY,
      "comunhao",
      [
        candidate("a", {}, "A"),
        candidate("b", { officialReference: "Hinário Litúrgico da CNBB, fascículo 3" }, "B"),
      ],
      2,
    ).suggestions;

    expect(editorial).toMatchObject({ basis: "editorial", officialReference: null });
    expect(official).toMatchObject({ basis: "official", officialReference: "Hinário Litúrgico da CNBB, fascículo 3" });
  });
});

describe("celebração inteira", () => {
  it("devolve os momentos na ordem da missa, com a orientação de cada um", () => {
    const result = suggestForCelebration(ADVENT, [candidate("x", { moments: ["entrada", "gloria"] })]);

    expect(result.map((entry) => entry.moment).slice(0, 3)).toEqual(["entrada", "ato-penitencial", "gloria"]);
    expect(result).toHaveLength(11);
    expect(result.find((entry) => entry.moment === "gloria")).toMatchObject({
      guidance: { status: "omitted" },
      suggestions: [],
      total: 0,
    });
    expect(result.find((entry) => entry.moment === "entrada")?.total).toBe(1);
  });

  it("sem músicas pertinentes, não inventa sugestões", () => {
    const result = suggestForCelebration(ORDINARY, []);
    expect(result.every((entry) => entry.suggestions.length === 0 && entry.total === 0)).toBe(true);
  });

  it("filtra por um momento", () => {
    const result = suggestForCelebration(ORDINARY, [candidate("x", {})], { moments: ["comunhao"], limitPerMoment: 24 });
    expect(result.map((entry) => entry.moment)).toEqual(["comunhao"]);
  });
});

describe("estado editorial da celebração", () => {
  const pastor = candidate("pastor", { moments: ["comunhao"], scripture: [{ book: "sl", chapter: 23 }], themes: ["bom-pastor"] });
  const psalm23 = candidate("salmo-23", { moments: ["salmo-responsorial"], scripture: [{ book: "sl", chapter: 23 }] });

  it("celebração revisada e completa, com classificação conferida: sugestões definitivas", () => {
    const reviewedPastor = { ...pastor, liturgy: { ...pastor.liturgy, reviewStatus: "reviewed" as const } };
    const result = recommendForCelebration(reviewedContext("2026-11-22"), [reviewedPastor]);
    expect(result.assurance).toBe("definitive");
    expect(result.cautions).toEqual([]);
    expect(result.moments.find((entry) => entry.moment === "comunhao")?.suggestions[0]?.classification).toBe("reviewed");
  });

  it("classificação ainda não conferida: a música aparece, marcada, e o resultado é provisório", () => {
    const result = recommendForCelebration(reviewedContext("2026-11-22"), [pastor]);
    expect(result.assurance).toBe("provisional");
    expect(result.cautions).toEqual(["Há músicas sugeridas com classificação ainda não conferida por uma pessoa da equipe."]);
    expect(result.moments.find((entry) => entry.moment === "comunhao")?.suggestions[0]?.classification).toBe(
      "pending_review",
    );
  });

  it("classificação em divergência nunca é sugerida", () => {
    const disputed = { ...pastor, liturgy: { ...pastor.liturgy, reviewStatus: "disputed" as const } };
    expect(checkEligibility(reviewedContext("2026-11-22"), "comunhao", disputed.liturgy)).toEqual({
      eligible: false,
      rule: "classification-disputed",
    });
    const result = recommendForCelebration(reviewedContext("2026-11-22"), [disputed]);
    expect(result.moments.find((entry) => entry.moment === "comunhao")?.total).toBe(0);
  });

  it("dados em revisão: as mesmas sugestões, mas provisórias", () => {
    const pending = recommendForCelebration(editorialContext("2026-11-22"), [pastor]);
    const reviewed = recommendForCelebration(reviewedContext("2026-11-22"), [pastor]);

    expect(pending.assurance).toBe("provisional");
    expect(pending.cautions[0]).toContain("ainda não foram aprovados por uma revisão humana");
    expect(pending.moments).toEqual(reviewed.moments);
  });

  it("salmo não conferido: nada é sugerido para ele, e o motivo é informado", () => {
    const result = recommendForCelebration(reviewedContext("2026-12-20"), [psalm23]);
    expect(result.assurance).toBe("provisional");
    expect(result.cautions).toContain("Ainda não conferido: salmo responsorial. Nada é sugerido no lugar.");
    expect(result.moments.find((entry) => entry.moment === "salmo-responsorial")?.total).toBe(0);
  });

  it("leitura em divergência não embasa sugestão nem o salmo", () => {
    const disputed = editorialContext("2026-11-22", {
      reviewStatus: "disputed",
      dispute: { fields: ["psalm"], note: "x", by: "admin", at: "2026-11-14T00:00:00.000Z" },
    });
    expect(usableReadings(disputed).map((reading) => reading.role)).toEqual(["first", "second", "gospel"]);

    const result = recommendForCelebration(disputed, [pastor, psalm23]);
    expect(result.cautions.join(" ")).toContain("Há divergência em: salmo responsorial");
    expect(result.moments.find((entry) => entry.moment === "salmo-responsorial")?.total).toBe(0);
    // Pastor continua elegível pela Comunhão, mas sem a correspondência com o salmo contestado.
    const [suggestion] = result.moments.find((entry) => entry.moment === "comunhao")!.suggestions;
    expect(suggestion.matches.readings).toEqual([]);
    expect(JSON.stringify(suggestion.reasons)).not.toContain("salmo");
  });

  it("separa os critérios: elegibilidade, correspondências e prioridade", () => {
    const [suggestion] = recommendForCelebration(reviewedContext("2026-11-22"), [pastor]).moments.find(
      (entry) => entry.moment === "comunhao",
    )!.suggestions;
    expect(suggestion.matches).toEqual({ celebrations: [], readings: ["psalm"], season: false, themes: ["bom-pastor"] });
    expect(suggestion.priority).toEqual([0, 1, 0, 1]);
  });

  it("canto próprio do rito nunca é substituído por música só tematicamente parecida", () => {
    const themed = candidate("tematica", { moments: ["comunhao"], themes: ["reino-de-deus", "bom-pastor", "caridade"] });
    const result = recommendForCelebration(reviewedContext("2026-11-22"), [themed]);
    for (const moment of ["gloria", "santo", "cordeiro-de-deus", "salmo-responsorial", "aclamacao-ao-evangelho"]) {
      expect(result.moments.find((entry) => entry.moment === moment)?.total).toBe(0);
    }
  });
});

describe("diagnóstico das sugestões", () => {
  it("conta classificadas, elegíveis, conferidas, com cifra e o motivo de cada descarte", () => {
    const context = reviewedContext("2026-11-22");
    const reviewed = candidate("a", { moments: ["comunhao"], reviewStatus: "reviewed" });
    const noChords = { ...candidate("b", { moments: ["comunhao"] }), hasChordPro: false, contentType: "metadata-only" as const };
    const lent = candidate("c", { moments: ["comunhao"], seasons: ["quaresma"] });
    const disputed = candidate("d", { moments: ["comunhao"], reviewStatus: "disputed" });
    const entrance = candidate("e", { moments: ["entrada"] });

    const communion = diagnoseCelebration(context, [reviewed, noChords, lent, disputed, entrance]).find(
      (entry) => entry.moment === "comunhao",
    );
    expect(communion).toEqual({
      moment: "comunhao",
      classified: 4,
      eligible: 2,
      reviewed: 1,
      withChordPro: 1,
      discarded: { "other-season-or-celebration": 1, "classification-disputed": 1 },
    });
  });

  it("usa as mesmas regras das sugestões", () => {
    const context = reviewedContext("2026-11-22");
    const candidates = [candidate("a", {}), candidate("b", { seasons: ["quaresma"] }), candidate("c", { avoidSeasons: ["tempo-comum"] })];
    const diagnosis = diagnoseCelebration(context, candidates).find((entry) => entry.moment === "comunhao");
    const suggested = recommendForCelebration(context, candidates).moments.find((entry) => entry.moment === "comunhao");
    expect(diagnosis?.eligible).toBe(suggested?.total);
  });
});

