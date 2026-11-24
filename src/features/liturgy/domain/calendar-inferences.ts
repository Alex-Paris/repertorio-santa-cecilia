import { addDays, isValidIsoDate, type LectionaryCycle } from "./calendar";
import type { LiturgicalSeasonId } from "./vocabulary";

function civilDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Cômputo gregoriano de Meeus/Jones/Butcher. Não fornece leituras nem celebrações. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return civilDate(year, Math.floor(n / 31), n % 31 + 1);
}

export function firstSundayOfAdvent(year: number): string {
  const firstPossible = civilDate(year, 11, 27);
  return addDays(firstPossible, (7 - weekday(firstPossible)) % 7);
}

/** Regras gerais em uso no Brasil. Permanecem inferências sujeitas à conferência. */
export function inferCalendar(date: string): { season: LiturgicalSeasonId; cycle: LectionaryCycle } {
  if (!isValidIsoDate(date)) throw new Error("Data civil inválida.");
  const year = Number(date.slice(0, 4));
  const advent = firstSundayOfAdvent(year);
  const liturgicalYear = date >= advent ? year + 1 : year;
  const cycle: LectionaryCycle = {
    sunday: (["C", "A", "B"] as const)[liturgicalYear % 3],
    weekday: liturgicalYear % 2 ? "I" : "II",
  };
  // Epifania no domingo entre 2 e 8/1; Batismo na segunda se ela cair em 7 ou 8/1.
  const jan2 = civilDate(year, 1, 2);
  const epiphany = addDays(jan2, (7 - weekday(jan2)) % 7);
  const baptism = addDays(epiphany, Number(epiphany.slice(8)) >= 7 ? 1 : 7);
  const easter = easterSunday(year);
  let season: LiturgicalSeasonId = "tempo-comum";
  if (date <= baptism || date >= civilDate(year, 12, 25)) season = "natal";
  else if (date >= advent) season = "advento";
  else if (date >= easter && date <= addDays(easter, 49)) season = "pascoa";
  else if (date >= addDays(easter, -3) && date < easter) season = "triduo-pascal";
  else if (date >= addDays(easter, -46) && date < easter) season = "quaresma";
  return { season, cycle };
}
