import { z } from "zod";

import {
  DEFAULT_CELEBRATION_PAGE_SIZE,
  MAX_CELEBRATION_PAGE_SIZE,
  MAX_CELEBRATION_RANGE_DAYS,
  REVIEW_STATUSES,
  daysBetween,
  isValidIsoDate,
  type CelebrationQuery,
} from "./calendar";
import { LITURGICAL_SEASON_IDS } from "./vocabulary";

export const MAX_CELEBRATION_PAGE = 200;

const date = z.string().refine(isValidIsoDate, "Use datas no formato AAAA-MM-DD.");

/** Busca de celebrações: tudo validado e limitado. Nunca devolve o calendário inteiro de uma vez. */
export const celebrationQuerySchema: z.ZodType<CelebrationQuery> = z
  .strictObject({
    from: date.optional(),
    to: date.optional(),
    q: z.string().trim().max(100).optional(),
    season: z.enum(LITURGICAL_SEASON_IDS).optional(),
    status: z.enum(REVIEW_STATUSES).optional(),
    diocese: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional(),
    page: z.coerce.number().int().min(1).max(MAX_CELEBRATION_PAGE).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_CELEBRATION_PAGE_SIZE).optional().default(DEFAULT_CELEBRATION_PAGE_SIZE),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "A data inicial vem antes da final.",
    path: ["to"],
  })
  .refine((query) => !query.from || !query.to || daysBetween(query.from, query.to) <= MAX_CELEBRATION_RANGE_DAYS, {
    message: `Consulte no máximo ${MAX_CELEBRATION_RANGE_DAYS} dias por vez.`,
    path: ["to"],
  });
