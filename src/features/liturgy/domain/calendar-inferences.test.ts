import { describe, expect, it } from "vitest";

import { easterSunday, inferCalendar } from "./calendar-inferences";

describe("inferências gerais do calendário", () => {
  it("muda o ciclo no Advento, sem alterar o ano civil da data", () => {
    expect(inferCalendar("2026-11-28")).toMatchObject({ season: "tempo-comum", cycle: { sunday: "A", weekday: "II" } });
    expect(inferCalendar("2026-11-29")).toMatchObject({ season: "advento", cycle: { sunday: "B", weekday: "I" } });
    expect(inferCalendar("2027-11-28").cycle.sunday).toBe("C");
  });
  it("mantém Natal até o Batismo, incluindo a segunda-feira após Epifania em 7 ou 8/1", () => {
    for (const date of ["2027-01-10", "2023-01-09", "2024-01-08", "2026-12-25"]) expect(inferCalendar(date).season).toBe("natal");
    for (const date of ["2027-01-11", "2023-01-10", "2024-01-09"]) expect(inferCalendar(date).season).toBe("tempo-comum");
  });
  it("respeita os limites móveis da Quaresma, do Tríduo e da Páscoa", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(inferCalendar("2027-02-09").season).toBe("tempo-comum");
    expect(inferCalendar("2027-02-10").season).toBe("quaresma");
    expect(inferCalendar("2027-03-24").season).toBe("quaresma");
    expect(inferCalendar("2027-03-25").season).toBe("triduo-pascal");
    expect(inferCalendar("2027-03-28").season).toBe("pascoa");
    expect(inferCalendar("2027-05-16").season).toBe("pascoa");
    expect(inferCalendar("2027-05-17").season).toBe("tempo-comum");
  });
});
