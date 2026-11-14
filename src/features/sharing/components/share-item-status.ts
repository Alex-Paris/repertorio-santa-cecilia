import type { PublicShareContent } from "../domain/public-share";

export function describeShareContent(content: PublicShareContent): string {
  switch (content.kind) {
    case "chordpro":
      return "Cifra incluída";
    case "external-link":
      return "Link externo";
    case "none":
      return "Sem cifra";
    case "unavailable":
      return "Indisponível";
  }
}
