"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { downloadTextFile } from "@/lib/utils/download-file";
import { showToast } from "@/lib/utils/toast";

import { accountLibrary } from "../data/browser-library";
import { fetchAccountBackup } from "../data/remote/backup-api";
import type { LibraryRecord } from "../domain/library";
import { getLibraryErrorMessage, LibraryError } from "../domain/library-errors";
import {
  createLibraryBackup,
  getBackupFileName,
  serializeLibraryBackup,
} from "../services/library-backup";

/** Exporta a conta a partir de um retrato completo pedido ao servidor. */
export function ExportBackupButton() {
  const [pending, setPending] = useState(false);

  async function handleExport(): Promise<void> {
    setPending(true);
    try {
      const userId = accountLibrary.getRemoteUserId();
      if (!userId) {
        throw new LibraryError("session-expired");
      }

      const backup = await fetchAccountBackup(userId);
      downloadTextFile(
        getBackupFileName(new Date(backup.exportedAt)),
        serializeLibraryBackup(backup),
        "application/json",
      );
      showToast("Backup exportado.");
    } catch (error) {
      showToast(getLibraryErrorMessage(error), "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="lg" disabled={pending} onClick={() => void handleExport()}>
      <Download data-icon="inline-start" aria-hidden />
      {pending ? "Exportando…" : "Exportar backup"}
    </Button>
  );
}

/** Baixa uma biblioteca já lida do navegador, sem envolver o servidor. */
export function DownloadLegacyBackupButton({ library }: { library: LibraryRecord }) {
  function handleDownload(): void {
    const now = new Date();
    downloadTextFile(
      getBackupFileName(now),
      serializeLibraryBackup(createLibraryBackup(library, now)),
      "application/json",
    );
    showToast("Backup baixado.");
  }

  return (
    <Button variant="outline" size="lg" onClick={handleDownload}>
      <Download data-icon="inline-start" aria-hidden />
      Baixar backup local
    </Button>
  );
}
