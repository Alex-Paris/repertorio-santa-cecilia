"use client";

import { Download, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { Button } from "@/components/ui/button";
import { formatSongCount } from "@/features/songs/domain/song";
import { downloadTextFile } from "@/lib/utils/download-file";
import { showToast } from "@/lib/utils/toast";

import { deleteLegacyLibrary, type LegacyLibrary } from "../legacy/legacy-library";
import { DownloadLegacyBackupButton } from "./export-backup-button";

function formatRepertoireCount(count: number): string {
  return count === 1 ? "1 repertório" : `${count} repertórios`;
}

/**
 * Exclusão explícita da biblioteca antiga. Só a chave antiga deste navegador é apagada:
 * a conta, as publicações, a sessão e as preferências não são tocadas.
 */
export function LegacyDeletion({ legacy, disabled }: { legacy: LegacyLibrary; disabled: boolean }) {
  if (legacy.status !== "ready" && legacy.status !== "blocked") {
    return null;
  }

  const summary =
    legacy.status === "ready"
      ? `${formatSongCount(legacy.library.songs.length)} e ${formatRepertoireCount(legacy.library.repertoires.length)}`
      : "dados danificados, que não puderam ser lidos";

  return (
    <section aria-labelledby="apagar-biblioteca-antiga" className="max-w-xl space-y-3 border-t pt-6">
      <h2 id="apagar-biblioteca-antiga" className="text-lg font-semibold tracking-tight">
        Apagar biblioteca antiga deste navegador
      </h2>
      <p className="text-sm text-muted-foreground">
        Guardado neste navegador: {summary}. Apagar remove somente esta cópia antiga. Sua conta,
        seus links públicos e sua sessão continuam como estão.
      </p>
      <p className="text-sm text-muted-foreground">
        Estes dados podem não estar na sua conta: uma importação anterior pode ter usado outra
        biblioteca ou apenas parte dela. Baixe um backup antes.
      </p>

      <div className="flex flex-wrap gap-2">
        {legacy.status === "ready" ? (
          <DownloadLegacyBackupButton library={legacy.library} />
        ) : (
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              downloadTextFile("repertorio-dados-originais.json", legacy.rawData, "application/json")
            }
          >
            <Download data-icon="inline-start" aria-hidden />
            Baixar dados originais
          </Button>
        )}
        <ConfirmDialog
          trigger={
            <Button variant="destructive" size="lg" disabled={disabled}>
              <Trash2 data-icon="inline-start" aria-hidden />
              Apagar deste navegador
            </Button>
          }
          title="Apagar a biblioteca antiga deste navegador?"
          description={`Serão apagados deste navegador: ${summary}. A ação não pode ser desfeita, e estes dados podem não estar na sua conta. Isto não exclui sua conta nem nada salvo nela.`}
          confirmLabel="Apagar deste navegador"
          onConfirm={() => {
            deleteLegacyLibrary(() => window.localStorage);
            showToast("Biblioteca antiga apagada deste navegador.");
          }}
        />
      </div>
    </section>
  );
}
