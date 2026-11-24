import { z } from "zod";

import { repertoireSchema } from "@/features/repertoires/domain/repertoire-schema";

export const cloneShareRequestSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/),
  requestId: z.uuid(),
});

export const cloneShareResponseSchema = z.strictObject({
  repertoire: repertoireSchema,
  skippedItems: z.number().int().nonnegative(),
});

export type CloneShareRequest = z.infer<typeof cloneShareRequestSchema>;
export type CloneShareResult = z.infer<typeof cloneShareResponseSchema>;
