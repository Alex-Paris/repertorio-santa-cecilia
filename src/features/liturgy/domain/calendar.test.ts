import { describe, expect, it } from "vitest";

import { editorialContext } from "@/test/liturgy-fixtures";

import { EDITORIAL_CELEBRATIONS, parseEditorialCelebrations } from "../data/editorial-celebrations";
import raw from "../data/editorial-celebrations.json";
import {
  addDays,
  celebrationDisplayTitle,
  daysBetween,
  externalLiturgyUrl,
  formatLongDate,
  formatShortDate,
  isValidIsoDate,
  todayInBrazil,
} from "./calendar";
import { computeProvenance } from "./celebration-record";

describe("datas civis", () => {
  it("aceita só datas reais no formato AAAA-MM-DD", () => {
    expect(isValidIsoDate("2026-11-15")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2027-02-29")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("15/11/2026")).toBe(false);
    expect(isValidIsoDate("2026-11-15T00:00:00Z")).toBe(false);
    expect(isValidIsoDate(undefined)).toBe(false);
    expect(isValidIsoDate(["2026-11-15"])).toBe(false);
  });

  it("formata e calcula sem depender do fuso horário", () => {
    expect(formatLongDate("2026-11-15")).toBe("domingo, 15 de novembro de 2026");
    expect(formatShortDate("2027-01-01")).toBe("1 de janeiro de 2027");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-11-01", 30)).toBe("2026-12-01");
    expect(daysBetween("2026-11-15", "2027-01-01")).toBe(47);
  });

  it("hoje é a data do Brasil, não a data UTC", () => {
    // 23h30 em São Paulo ainda é o dia 14, embora em UTC já seja o dia 15.
    expect(todayInBrazil(new Date("2026-11-15T02:30:00Z"))).toBe("2026-11-14");
    expect(todayInBrazil(new Date("2026-11-15T03:30:00Z"))).toBe("2026-11-15");
  });

  it("aponta para a liturgia do dia em fonte externa", () => {
    expect(externalLiturgyUrl("2026-12-06")).toBe("https://www.vaticannews.va/pt/palavra-do-dia/2026/12/06.html");
  });

  it("o título mostra o formulário quando não é o principal", () => {
    expect(celebrationDisplayTitle({ title: "Natal do Senhor", massVariant: "noite" })).toBe("Natal do Senhor — Missa da Noite");
    expect(celebrationDisplayTitle({ title: "Cristo Rei", massVariant: "principal" })).toBe("Cristo Rei");
  });
});

describe("as nove celebrações editoriais", () => {
  it("são preservadas, com os mesmos identificadores e datas", () => {
    expect(EDITORIAL_CELEBRATIONS.map((entry) => [entry.input.date, entry.id])).toEqual([
      ["2026-11-15", "2026-11-15-33-domingo-tempo-comum"],
      ["2026-11-22", "2026-11-22-cristo-rei"],
      ["2026-11-29", "2026-11-29-1-domingo-advento"],
      ["2026-12-06", "2026-12-06-2-domingo-advento"],
      ["2026-12-08", "2026-12-08-imaculada-conceicao"],
      ["2026-12-13", "2026-12-13-3-domingo-advento"],
      ["2026-12-20", "2026-12-20-4-domingo-advento"],
      ["2026-12-25", "2026-12-25-natal-missa-da-noite"],
      ["2027-01-01", "2027-01-01-santa-maria-mae-de-deus"],
    ]);
  });

  it("cada uma tem fonte registrada, com data de consulta e o que confirma", () => {
    for (const { input } of EDITORIAL_CELEBRATIONS) {
      expect(input.sources.length).toBeGreaterThan(0);
      for (const source of input.sources) {
        expect(source.accessedAt).toBe("2026-11-11");
        expect(source.verificationStatus).toBe("automated-comparison");
        expect(source.scope.length).toBeGreaterThan(0);
        expect(source.referenceUrl).toMatch(/^https:\/\//);
      }
    }
  });

  it("os salmos de 20/12 e 25/12 continuam não conferidos, sem estimativa", () => {
    for (const date of ["2026-12-20", "2026-12-25"]) {
      const context = editorialContext(date);
      expect(context.unverifiedReadings).toEqual(["psalm"]);
      expect(context.readings.map((reading) => reading.role)).toEqual(["first", "second", "gospel"]);
      expect(context.provenance.find((entry) => entry.field === "psalm")).toEqual({ field: "psalm", status: "missing" });
    }
  });

  it("o Natal identifica o formulário da Missa da Noite", () => {
    const context = editorialContext("2026-12-25");
    expect(context).toMatchObject({ celebrationKey: "natal-do-senhor", massVariant: "noite", title: "Natal do Senhor" });
    expect(context.notes.join(" ")).toContain("identificada pelas leituras");
  });

  it("uma fonte de outro país nunca confirma o calendário do Brasil", () => {
    // 06/12 e 01/01 foram conferidas só na USCCB: as leituras têm fonte; o calendário, não.
    for (const date of ["2026-12-06", "2027-01-01"]) {
      const provenance = editorialContext(date).provenance;
      for (const field of ["title", "rank", "season", "color", "cycle"]) {
        expect(provenance.find((entry) => entry.field === field)?.status).toBe("inference");
      }
      for (const field of ["first", "psalm", "second", "gospel"]) {
        expect(provenance.find((entry) => entry.field === field)).toMatchObject({ status: "source", sourceIds: ["usccb"] });
      }
    }
  });

  it("separa fato confirmado de inferência", () => {
    const ordinary = editorialContext("2026-11-15");
    expect(ordinary.liturgicalColor).toEqual({ color: "verde", basis: "source" });
    expect(ordinary.provenance.find((entry) => entry.field === "title")).toMatchObject({ status: "source", sourceIds: ["cancao-nova"] });
    // O ciclo do Lecionário não foi confirmado em nenhuma fonte.
    expect(ordinary.provenance.find((entry) => entry.field === "cycle")?.status).toBe("inference");

    // Cristo Rei: a fonte não diz o tempo; 13/12: a cor vem da regra geral.
    expect(editorialContext("2026-11-22").provenance.find((entry) => entry.field === "season")?.status).toBe("inference");
    expect(editorialContext("2026-12-13").liturgicalColor).toMatchObject({ color: "roxo", basis: "rule" });
  });

  it("temas são interpretação editorial e nunca aparecem como fato com fonte", () => {
    for (const { input } of EDITORIAL_CELEBRATIONS) {
      const fields = computeProvenance(input).map((entry) => entry.field as string);
      expect(fields).not.toContain("biblicalThemes");
    }
  });

  it("o arquivo inteiro é recusado se uma celebração estiver fora do formato", () => {
    const broken = structuredClone(raw) as { celebrations: Record<string, unknown>[] };
    broken.celebrations[6].readings = [
      ...(broken.celebrations[6].readings as unknown[]),
      { role: "psalm", citation: "Sl 88(89)", ranges: [{ book: "sl", chapter: 89 }] },
    ];
    expect(() => parseEditorialCelebrations(broken)).toThrow(/Celebração 7 inválida/);
    expect(() => parseEditorialCelebrations({})).toThrow();
  });
});
