import type { LiturgicalMomentId } from "@/features/liturgy/domain/vocabulary";
import type { IsoDateTime, Revision, SongId, SongSource } from "@/features/songs/domain/song";

export type RepertoireId = string;
export type RepertoireItemId = string;

/**
 * Participação de uma música em um repertório. A ordem e o tom ficam no item,
 * permitindo que a mesma música tenha configurações diferentes em cada repertório.
 */
export interface RepertoireItem {
  id: RepertoireItemId;
  songId: SongId;
  /** Catálogo central ou biblioteca particular. Junto com `songId`, identifica a música. */
  source: SongSource;
  position: number;
  notes?: string;
  transposeSemitones: number;
  /** Momento da missa em que a música será cantada. Ausente em repertórios que não são de missa. */
  moment?: LiturgicalMomentId;
}

/**
 * Missa a que o repertório se destina. Opcional: um repertório de ensaio não tem este campo,
 * e os anteriores à Etapa 2E.2 nunca o recebem automaticamente.
 */
export interface RepertoireMass {
  /** Data civil da celebração, `AAAA-MM-DD`. */
  date: string;
  /** Celebração da base litúrgica usada na preparação, quando houver. */
  celebrationId?: string;
  /** Nome da celebração, guardado para o repertório não depender da base. */
  title: string;
  /** Revisão da celebração quando o repertório foi montado, para avisar se ela mudar depois. */
  celebrationRevision?: number;
}

/** Formato do backup e da biblioteca antiga do navegador: sem controle de versão. */
export interface RepertoireRecord {
  id: RepertoireId;
  name: string;
  description: string;
  mass?: RepertoireMass;
  items: RepertoireItem[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Repertório como a conta o entrega. Itens, tom, anotações e ordem mudam a mesma revisão. */
export type Repertoire = RepertoireRecord & { revision: Revision };

/** Dados informados pelo usuário; músicas são gerenciadas por operações próprias. */
export type RepertoireInput = Pick<Repertoire, "name" | "description"> & {
  /** Ausente: mantém como está. `null`: desvincula o repertório da missa. */
  mass?: RepertoireMass | null;
};

/** Campos ajustáveis de um item. Em `notes`, texto vazio remove a anotação. */
export type RepertoireItemChanges = Partial<Pick<RepertoireItem, "transposeSemitones" | "notes">> & {
  /** `null` remove o momento do item. */
  moment?: LiturgicalMomentId | null;
};

export type RepertoireItemInput = Omit<RepertoireItem, "transposeSemitones" | "source"> & {
  transposeSemitones?: number;
  source?: SongSource;
};

export function createRepertoireItem(input: RepertoireItemInput): RepertoireItem {
  return { ...input, source: input.source ?? "personal", transposeSemitones: input.transposeSemitones ?? 0 };
}
