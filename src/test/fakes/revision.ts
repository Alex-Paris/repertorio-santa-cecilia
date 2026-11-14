import { LibraryError } from "@/features/library/domain/library-errors";
import { revisionSchema } from "@/features/songs/domain/song-schema";

/** Mesma regra do servidor: sem revisão esperada válida, nada é alterado. */
export function checkRevision(current: number, expected: unknown): void {
  if (!revisionSchema.safeParse(expected).success) {
    throw new LibraryError("revision-required");
  }
  if (current !== expected) {
    throw new LibraryError("revision-conflict");
  }
}
