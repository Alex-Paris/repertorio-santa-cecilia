import { collectFieldErrors } from "@/lib/utils/collect-field-errors";

import type { RepertoireInput } from "../domain/repertoire";
import { repertoireInputSchema, repertoireItemChangesSchema } from "../domain/repertoire-schema";

export type RepertoireFormValues = RepertoireInput;

export type RepertoireFormField = keyof RepertoireFormValues;

export type RepertoireFormErrors = Partial<Record<RepertoireFormField, string>>;

const FIELDS: readonly RepertoireFormField[] = ["name", "description", "mass"];

export const EMPTY_REPERTOIRE_FORM: RepertoireFormValues = { name: "", description: "" };

export type RepertoireFormResult =
  | { success: true; input: RepertoireInput }
  | { success: false; errors: RepertoireFormErrors };

export function parseRepertoireForm(values: RepertoireFormValues): RepertoireFormResult {
  const result = repertoireInputSchema.safeParse(values);

  return result.success
    ? { success: true, input: result.data }
    : { success: false, errors: collectFieldErrors(result.error.issues, FIELDS) };
}

export type ItemNotesResult =
  | { success: true; notes: string }
  | { success: false; error: string };

export function parseRepertoireItemNotes(value: string): ItemNotesResult {
  const result = repertoireItemChangesSchema.safeParse({ notes: value });

  return result.success
    ? { success: true, notes: result.data.notes ?? "" }
    : { success: false, error: result.error.issues[0].message };
}
