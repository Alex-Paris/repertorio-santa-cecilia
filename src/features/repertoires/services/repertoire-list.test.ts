import { describe, expect, it } from "vitest";

import type { Repertoire } from "../domain/repertoire";
import { groupRepertoiresForList } from "./repertoire-list";

function repertoire(id: string, updatedAt: string, massDate?: string): Repertoire {
  return {
    id,
    name: id,
    description: "",
    items: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
    revision: 1,
    ...(massDate ? { mass: { date: massDate, title: `Missa ${massDate}` } } : {}),
  } as Repertoire;
}

describe("ordem da lista de repertórios", () => {
  const list = [
    repertoire("ensaio", "2026-11-18T10:00:00.000Z"),
    repertoire("advento", "2026-11-01T10:00:00.000Z", "2026-11-29"),
    repertoire("passada", "2026-11-19T10:00:00.000Z", "2026-11-15"),
    repertoire("cristo-rei", "2026-10-01T10:00:00.000Z", "2026-11-22"),
    repertoire("hoje", "2026-09-01T10:00:00.000Z", "2026-11-19"),
  ];

  it("próximas missas primeiro, da mais próxima para a mais distante, incluindo a de hoje", () => {
    const { upcoming } = groupRepertoiresForList(list, "2026-11-19");
    expect(upcoming.map((entry) => entry.id)).toEqual(["hoje", "cristo-rei", "advento"]);
  });

  it("os demais, sem missa ou de missas passadas, do editado mais recentemente", () => {
    const { others } = groupRepertoiresForList(list, "2026-11-19");
    expect(others.map((entry) => entry.id)).toEqual(["passada", "ensaio"]);
  });

  it("não perde nem repete repertórios", () => {
    const { upcoming, others } = groupRepertoiresForList(list, "2026-11-19");
    expect([...upcoming, ...others].map((entry) => entry.id).sort()).toEqual(list.map((entry) => entry.id).sort());
  });
});
