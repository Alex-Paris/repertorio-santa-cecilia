import type { Repertoire } from "../domain/repertoire";

export interface RepertoireGroups {
  /** Missas de hoje em diante, da mais próxima para a mais distante. */
  upcoming: Repertoire[];
  /** Os demais (sem missa ou de missas passadas), do editado mais recentemente para o mais antigo. */
  others: Repertoire[];
}

/**
 * Ordem da lista de repertórios: o que a pessoa vai usar logo vem primeiro. `today` é a data
 * civil no Brasil (AAAA-MM-DD), comparada como texto com a data da missa.
 */
export function groupRepertoiresForList(repertoires: readonly Repertoire[], today: string): RepertoireGroups {
  const upcoming = repertoires
    .filter((repertoire) => repertoire.mass && repertoire.mass.date >= today)
    .sort((a, b) => a.mass!.date.localeCompare(b.mass!.date) || a.name.localeCompare(b.name, "pt-BR"));
  const upcomingIds = new Set(upcoming.map((repertoire) => repertoire.id));
  const others = repertoires
    .filter((repertoire) => !upcomingIds.has(repertoire.id))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { upcoming, others };
}
