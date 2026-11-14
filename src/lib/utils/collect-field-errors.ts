interface FieldIssue {
  path: readonly PropertyKey[];
  message: string;
}

/** Associa cada campo à primeira mensagem de erro encontrada para ele. */
export function collectFieldErrors<Field extends string>(
  issues: readonly FieldIssue[],
  fields: readonly Field[],
): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};

  for (const issue of issues) {
    const field = fields.find((candidate) => candidate === issue.path[0]);
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}
