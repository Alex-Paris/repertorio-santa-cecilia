/** Aceita apenas links http(s), impedindo esquemas perigosos como `javascript:`. */
export function isSafeExternalUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
