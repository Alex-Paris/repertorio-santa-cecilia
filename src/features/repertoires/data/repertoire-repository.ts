import type { LiturgicalMomentId } from "@/features/liturgy/domain/vocabulary";
import type { Revision, SongId, SongSource } from "@/features/songs/domain/song";

import type {
  Repertoire,
  RepertoireId,
  RepertoireInput,
  RepertoireItemChanges,
  RepertoireItemId,
} from "../domain/repertoire";
import type { MoveDirection } from "../services/repertoire-items";

/** Operações de leitura de repertórios. */
export interface RepertoireReader {
  list(): Promise<Repertoire[]>;
  findById(id: RepertoireId): Promise<Repertoire | null>;
}

/**
 * Contrato de acesso aos repertórios; assíncrono pelo mesmo motivo de `SongRepository`.
 * As operações de escrita rejeitam com `LibraryError` quando os dados não forem salvos.
 */
export interface RepertoireRepository extends RepertoireReader {
  create(input: RepertoireInput): Promise<Repertoire>;
  /** Toda alteração exige a revisão esperada do repertório inteiro, inclusive as dos itens. */
  update(id: RepertoireId, input: RepertoireInput, expectedRevision: Revision): Promise<Repertoire>;
  delete(id: RepertoireId, expectedRevision: Revision): Promise<void>;
  /**
   * Rejeita se a música não existir ou já estiver no repertório. Do catálogo, só publicadas;
   * particulares, só da própria conta. Sem `source`, a música é particular. Com `moment`,
   * o item entra na ordem da missa; sem ele, no fim.
   */
  addSong(
    id: RepertoireId,
    songId: SongId,
    expectedRevision: Revision,
    source?: SongSource,
    moment?: LiturgicalMomentId,
  ): Promise<Repertoire>;
  removeItem(id: RepertoireId, itemId: RepertoireItemId, expectedRevision: Revision): Promise<Repertoire>;
  /** Altera tom ou anotações de um único item. Link externo não aceita tom diferente do original. */
  updateItem(
    id: RepertoireId,
    itemId: RepertoireItemId,
    changes: RepertoireItemChanges,
    expectedRevision: Revision,
  ): Promise<Repertoire>;
  moveItem(
    id: RepertoireId,
    itemId: RepertoireItemId,
    direction: MoveDirection,
    expectedRevision: Revision,
  ): Promise<Repertoire>;
}

export function createInMemoryRepertoireRepository(
  seed: readonly Repertoire[],
): RepertoireReader {
  const repertoiresById = new Map(seed.map((repertoire) => [repertoire.id, repertoire]));

  return {
    list: async () => [...repertoiresById.values()],
    findById: async (id) => repertoiresById.get(id) ?? null,
  };
}
