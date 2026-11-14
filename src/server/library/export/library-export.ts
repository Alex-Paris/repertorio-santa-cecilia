import "server-only";

import type { TransactionOptions } from "mongodb";

import { LibraryError } from "@/features/library/domain/library-errors";
import { createLibraryBackup, type LibraryBackup } from "@/features/library/services/library-backup";
import { RepertoireModel } from "@/server/database/models/repertoire-model";
import { SongModel } from "@/server/database/models/song-model";
import { toDomainRepertoire, toDomainSong } from "@/server/repositories/document-mappers";
import { runTransaction } from "@/server/repositories/persistence";

/** Músicas e repertórios vistos no mesmo instante, mesmo com escritas simultâneas. */
const EXPORT_TRANSACTION_OPTIONS: TransactionOptions = {
  readPreference: "primary",
  readConcern: { level: "snapshot" },
};

const MAX_EXPORT_SONGS = 20_000;
const MAX_EXPORT_REPERTOIRES = 5000;
const MAX_EXPORT_CHORDPRO_BYTES = 64 * 1024 * 1024;

const TOO_LARGE_MESSAGE = "Esta biblioteca é grande demais para ser exportada de uma vez.";

/** Somente os campos do formato de backup: nada de sessões, proprietário ou publicações. */
export function exportLibrary(ownerId: string): Promise<LibraryBackup> {
  return runTransaction(async (session) => {
    // Em sequência: uma sessão do MongoDB não aceita operações paralelas em uma transação.
    const [usage] = await SongModel.aggregate<{ songs: number; bytes: number }>([
      { $match: { ownerId } },
      {
        $group: {
          _id: null,
          songs: { $sum: 1 },
          bytes: { $sum: { $strLenBytes: { $ifNull: ["$chordPro", ""] } } },
        },
      },
    ]).session(session);
    const repertoireCount = await RepertoireModel.countDocuments({ ownerId }).session(session);

    if (
      (usage?.songs ?? 0) > MAX_EXPORT_SONGS ||
      (usage?.bytes ?? 0) > MAX_EXPORT_CHORDPRO_BYTES ||
      repertoireCount > MAX_EXPORT_REPERTOIRES
    ) {
      throw new LibraryError("import-limit-exceeded", TOO_LARGE_MESSAGE);
    }

    const songs = await SongModel.find({ ownerId }).sort({ createdAt: 1 }).session(session).lean();
    const repertoires = await RepertoireModel.find({ ownerId }).sort({ createdAt: 1 }).session(session).lean();

    return createLibraryBackup(
      { songs: songs.map(toDomainSong), repertoires: repertoires.map(toDomainRepertoire) },
      new Date(),
    );
  }, EXPORT_TRANSACTION_OPTIONS);
}
