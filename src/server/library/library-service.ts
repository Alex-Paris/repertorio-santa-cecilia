import "server-only";

import type { RepertoireRepository } from "@/features/repertoires/data/repertoire-repository";
import type { SongRepository } from "@/features/songs/data/song-repository";
import type { CatalogSongView } from "@/features/library/domain/library";
import type { LibraryBackup } from "@/features/library/services/library-backup";
import { toCatalogSongView } from "@/features/catalog/domain/catalog-song";
import type { Repertoire } from "@/features/repertoires/domain/repertoire";
import { resolveSongReferences } from "@/server/catalog/song-resolver";
import { runPersistence } from "@/server/repositories/persistence";
import { exportLibrary } from "@/server/library/export/library-export";
import {
  createLibraryImportService,
  type LibraryImportService,
} from "@/server/library/import/library-import-service";
import { createMongoLibraryImportStore } from "@/server/library/import/mongo-library-import-store";
import { createMongoRepertoireRepository } from "@/server/repositories/mongo-repertoire-repository";
import { createMongoSongRepository } from "@/server/repositories/mongo-song-repository";
import { createShareService, type ShareService } from "@/server/sharing/share-service";

export interface LibraryService {
  songs: SongRepository;
  repertoires: RepertoireRepository;
  imports: LibraryImportService;
  shares: ShareService;
  exportBackup(): Promise<LibraryBackup>;
  /** Músicas publicadas do catálogo usadas nestes repertórios, em uma consulta. */
  catalogSongsFor(repertoires: readonly Repertoire[]): Promise<CatalogSongView[]>;
}

/** Biblioteca de um usuário. `ownerId` deve vir sempre da sessão validada no servidor. */
export function createLibraryService(ownerId: string): LibraryService {
  const context = { ownerId };
  return {
    songs: createMongoSongRepository(context),
    repertoires: createMongoRepertoireRepository(context),
    imports: createLibraryImportService(createMongoLibraryImportStore(context)),
    shares: createShareService(ownerId),
    exportBackup: () => exportLibrary(ownerId),
    catalogSongsFor: (repertoires) =>
      runPersistence(async () => {
        const references = repertoires.flatMap((repertoire) =>
          repertoire.items
            .filter((item) => item.source === "catalog")
            .map((item) => ({ source: item.source, songId: item.songId })),
        );
        const resolved = await resolveSongReferences(references, { ownerId });
        return [...resolved.values()].flatMap((entry) =>
          entry.source === "catalog" && entry.song.status === "published" ? [toCatalogSongView(entry.song)] : [],
        );
      }),
  };
}
