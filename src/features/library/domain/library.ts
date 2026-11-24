import type { PublicSongClassification } from "@/features/liturgy/domain/classification";
import type { Repertoire, RepertoireRecord } from "@/features/repertoires/domain/repertoire";
import type { MusicalSong, Song, SongId, SongRecord, SongSource } from "@/features/songs/domain/song";
import type { YouTubeReference } from "@/features/songs/domain/video-reference";

/** Conjunto das músicas e repertórios de um usuário, com a revisão de cada documento. */
export interface Library {
  songs: Song[];
  repertoires: Repertoire[];
  /** Músicas do catálogo usadas nos repertórios. Só as publicadas; a cifra só se autorizada. */
  catalogSongs: CatalogSongView[];
}

/** Música do catálogo como um usuário comum a vê. */
export type CatalogSongView = MusicalSong & {
  chordProAvailable: boolean;
  /** Classificação litúrgica pública, quando a administração a registrou. */
  liturgy?: PublicSongClassification;
  /** Referência da composição e fontes dos metadados, quando registradas. */
  compositionReference?: string;
  metadataSources?: { title: string; url?: string; accessedAt?: string }[];
  /** Vídeo de referência aprovado: só provedor e identificador, nunca um endereço livre. */
  video?: YouTubeReference;
  /** "Enviado por": nome público autorizado pelo colaborador. Nunca e-mail nem conta. */
  contributorCredit?: string;
};

/** Mesmo conjunto no formato do backup e da biblioteca antiga, sem revisões. */
export interface LibraryRecord {
  songs: SongRecord[];
  repertoires: RepertoireRecord[];
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/** Regras que dependem da biblioteca inteira. Retorna os problemas encontrados. */
export function findLibraryIntegrityIssues(library: LibraryRecord): string[] {
  const issues: string[] = [];
  const songIds = new Set(library.songs.map((song) => song.id));
  const items = library.repertoires.flatMap((repertoire) => repertoire.items);
  // Músicas do catálogo não estão no arquivo: a existência delas é conferida pelo servidor.
  const personalItems = items.filter((item) => item.source === "personal");

  if (hasDuplicates(library.songs.map((song) => song.id))) {
    issues.push("Há músicas com o mesmo ID.");
  }
  if (hasDuplicates(library.repertoires.map((repertoire) => repertoire.id))) {
    issues.push("Há repertórios com o mesmo ID.");
  }
  if (hasDuplicates(items.map((item) => item.id))) {
    issues.push("Há itens de repertório com o mesmo ID.");
  }
  if (personalItems.some((item) => !songIds.has(item.songId))) {
    issues.push("Há repertórios que apontam para músicas inexistentes.");
  }
  if (
    library.repertoires.some((repertoire) =>
      hasDuplicates(repertoire.items.map((item) => `${item.source}:${item.songId}`)),
    )
  ) {
    issues.push("Há músicas repetidas em um mesmo repertório.");
  }

  return issues;
}

/** Encontra a música de um item pela origem: nunca procura em outra origem como alternativa. */
export function findLibrarySong(
  library: Pick<Library, "songs" | "catalogSongs">,
  source: SongSource,
  songId: SongId,
): MusicalSong | undefined {
  return source === "catalog"
    ? library.catalogSongs.find((song) => song.id === songId)
    : library.songs.find((song) => song.id === songId);
}
