import { describe, expect, it } from "vitest";

import { editorialRecord } from "@/test/liturgy-fixtures";

import type { CelebrationSource } from "./calendar";
import {
  celebrationInputSchema,
  changedCelebrationFields,
  pickCelebrationInput,
  toCelebrationSummary,
  toPublicCelebration,
  type CelebrationInput,
} from "./celebration-record";

const BR_SOURCE: CelebrationSource = {
  id: "fonte-1",
  provider: "Fonte do Brasil",
  documentTitle: "Diretório Litúrgico",
  accessedAt: "2026-11-14",
  jurisdiction: "BR",
  scope: ["title", "rank", "season", "color", "first", "psalm", "second", "gospel"],
  verificationStatus: "human-check",
};

const base: CelebrationInput = {
  date: "2027-06-29",
  country: "BR",
  scope: "national",
  celebrationKey: "sao-pedro-e-sao-paulo",
  massVariant: "dia",
  title: "São Pedro e São Paulo",
  rank: "solenidade",
  season: "tempo-comum",
  lectionaryCycle: { sunday: "A", weekday: null },
  liturgicalColor: { color: "vermelho" },
  readings: [{ role: "gospel", citation: "Mt 16,13-19", ranges: [{ book: "mt", chapter: 16, verseStart: 13, verseEnd: 19 }] }],
  unverifiedReadings: ["psalm"],
  celebrations: ["santos"],
  biblicalThemes: [],
  notes: [],
  sources: [BR_SOURCE],
};

const issues = (input: unknown): string[] => {
  const result = celebrationInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("identificação da celebração", () => {
  it("a identidade é data, chave, formulário e calendário, nunca o título", () => {
    expect(issues(base)).toEqual([]);
    expect(issues({ ...base, celebrationKey: "São Pedro" })).toContain(
      "Use letras minúsculas, números e hífens na chave da celebração.",
    );
    expect(issues({ ...base, massVariant: "vespertina" })).not.toEqual([]);
  });

  it("aceita variantes de missa e a mesma data com formulários diferentes", () => {
    for (const massVariant of ["principal", "vigilia", "noite", "aurora", "dia"]) {
      expect(issues({ ...base, massVariant })).toEqual([]);
    }
  });

  it("país Brasil; diocese só em celebração diocesana", () => {
    expect(issues({ ...base, country: "US" })).not.toEqual([]);
    expect(issues({ ...base, scope: "diocesan" })).toContain("Informe a diocese somente em celebrações diocesanas.");
    expect(issues({ ...base, diocese: "sao-paulo" })).toContain("Informe a diocese somente em celebrações diocesanas.");
    expect(issues({ ...base, scope: "diocesan", diocese: "sao-paulo" })).toEqual([]);
    expect(issues({ ...base, scope: "diocesan", diocese: "São Paulo" })).not.toEqual([]);
  });

  it("valida a data civil e os ciclos do Lecionário", () => {
    expect(issues({ ...base, date: "2027-02-30" })).toContain("Informe uma data válida (AAAA-MM-DD).");
    expect(issues({ ...base, lectionaryCycle: { sunday: "D", weekday: null } })).not.toEqual([]);
    expect(issues({ ...base, lectionaryCycle: { sunday: "A", weekday: "I" } })).toContain(
      "O ciclo ferial não se aplica a domingos e solenidades.",
    );
    expect(issues({ ...base, rank: "feria", lectionaryCycle: { sunday: "A", weekday: "I" } })).toEqual([]);
  });
});

describe("fontes e leituras", () => {
  it("toda celebração precisa de fonte", () => {
    expect(issues({ ...base, sources: [], readings: [] })).toContain("Registre ao menos uma fonte.");
  });

  it("toda leitura registrada precisa de uma fonte que a confirme", () => {
    const withoutGospel = { ...BR_SOURCE, scope: ["title" as const] };
    expect(issues({ ...base, sources: [withoutGospel] })).toContain("Toda leitura registrada precisa de uma fonte que a confirme.");
  });

  it("fonte de outro país só confirma leituras", () => {
    const foreign: CelebrationSource = { ...BR_SOURCE, id: "fonte-2", jurisdiction: "other-country", scope: ["gospel", "title"] };
    expect(issues({ ...base, sources: [BR_SOURCE, foreign] })).toContain(
      "Uma fonte de outro país só pode confirmar referências de leituras, nunca o calendário do Brasil.",
    );
    expect(issues({ ...base, sources: [BR_SOURCE, { ...foreign, scope: ["gospel"] }] })).toEqual([]);
  });

  it("a fonte registra quem publica, o documento, a data da consulta e um endereço seguro", () => {
    expect(issues({ ...base, sources: [{ ...BR_SOURCE, provider: " " }] })).toContain("Informe quem publica a fonte.");
    expect(issues({ ...base, sources: [{ ...BR_SOURCE, accessedAt: "ontem" }] })).toContain("Informe a data da consulta.");
    expect(issues({ ...base, sources: [{ ...BR_SOURCE, referenceUrl: "javascript:alert(1)" }] })).toContain("Use um endereço http(s).");
    expect(issues({ ...base, sources: [BR_SOURCE, BR_SOURCE] })).toContain("Há fontes com o mesmo identificador.");
  });

  it("uma leitura não pode estar registrada e marcada como não conferida", () => {
    expect(issues({ ...base, unverifiedReadings: ["gospel"] })).toContain(
      "Uma leitura não pode estar registrada e marcada como não conferida.",
    );
  });

  it("referências bíblicas estruturadas; texto livre não é aceito", () => {
    expect(issues({ ...base, readings: [{ role: "gospel", citation: "Mt 16,13-19", ranges: [] }] })).toContain(
      "Informe ao menos um trecho bíblico.",
    );
    expect(
      issues({ ...base, readings: [{ role: "gospel", citation: "Mt 16", ranges: [{ book: "mt", chapter: 16, texto: "Tu és Pedro" }] }] }),
    ).not.toEqual([]);
  });
});

describe("projeção pública", () => {
  const record = editorialRecord("2026-11-22", {
    reviewStatus: "disputed",
    dispute: { fields: ["psalm"], note: "NOTA INTERNA DA DIVERGENCIA", by: "admin-secreto", at: "2026-11-14T00:00:00.000Z" },
  });

  it("não leva autoria, notas internas nem campos de controle", () => {
    const view = toPublicCelebration(record);
    const text = JSON.stringify(view);

    expect(text).not.toContain("NOTA INTERNA");
    expect(text).not.toContain("admin-secreto");
    expect(view).not.toHaveProperty("approval");
    expect(view).not.toHaveProperty("dispute");
    expect(view).not.toHaveProperty("createdAt");
    expect(view.review).toEqual({ status: "disputed", reviewedAt: null, disputedFields: ["psalm"] });
  });

  it("só mostra a data da aprovação quando está revisada", () => {
    const approved = editorialRecord("2026-11-22", {
      reviewStatus: "reviewed",
      approval: { by: "admin-secreto", at: "2026-11-14T10:00:00.000Z", revision: 1, sourceIds: ["cancao-nova"] },
    });
    expect(toPublicCelebration(approved).review).toEqual({ status: "reviewed", reviewedAt: "2026-11-14T10:00:00.000Z", disputedFields: [] });
    expect(JSON.stringify(toPublicCelebration(approved))).not.toContain("admin-secreto");
  });

  it("o resumo de listas não leva leituras nem fontes", () => {
    const summary = toCelebrationSummary(record);
    expect(Object.keys(summary).sort()).toEqual(["celebrationId", "color", "date", "massVariant", "rank", "reviewStatus", "revision", "scope", "season", "title"]);
  });
});

describe("campos alterados", () => {
  it("lista só o que mudou, para o histórico", () => {
    const before = pickCelebrationInput(editorialRecord("2026-11-22"));
    const after = { ...before, title: "Outro título", biblicalThemes: ["paz" as const] };
    expect(changedCelebrationFields(before, after)).toEqual(["biblicalThemes", "title"]);
    expect(changedCelebrationFields(before, structuredClone(before))).toEqual([]);
  });

  it("o conteúdo editável nunca leva estado, revisão ou identificador", () => {
    const content = pickCelebrationInput(editorialRecord("2026-11-22"));
    expect(content).not.toHaveProperty("id");
    expect(content).not.toHaveProperty("reviewStatus");
    expect(content).not.toHaveProperty("revision");
    expect(celebrationInputSchema.safeParse(content).success).toBe(true);
  });
});
