"use client";

import { cn } from "cn";
import { Pencil, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { repertoireRepository } from "@/features/library/data/browser-library";
import { LibraryGate } from "@/features/library/components/library-gate";
import type { CatalogSongView } from "@/features/library/domain/library";
import { MassCelebrationStatus } from "@/features/liturgy/components/mass-celebration-status";
import { PrintMenu } from "@/features/printing/components/print-menu";
import { formatLongDate } from "@/features/liturgy/domain/calendar";
import { formatSongCount, type Song } from "@/features/songs/domain/song";
import { showToast } from "@/lib/utils/toast";
import { useDocumentTitle } from "@/lib/utils/use-document-title";

import type { Repertoire, RepertoireId } from "../domain/repertoire";
import { buildRepertoireEntries } from "../services/repertoire-service";
import { AddSongToRepertoire } from "./add-song-to-repertoire";
import { RepertoireEntryList } from "./repertoire-entry-list";
import { RepertoireNotFound } from "./repertoire-not-found";

interface RepertoireDetailProps {
  repertoire: Repertoire;
  songs: readonly Song[];
  catalogSongs: readonly CatalogSongView[];
  onDelete: () => Promise<void>;
}

function RepertoireDetail({ repertoire, songs, catalogSongs, onDelete }: RepertoireDetailProps) {
  useDocumentTitle(repertoire.name);

  const entries = buildRepertoireEntries(repertoire.items, songs, catalogSongs);

  return (
    <>
      <PageHeader
        title={repertoire.name}
        back={{ href: "/repertorios", label: "Repertórios" }}
        description={
          <>
            {repertoire.mass && (
              <p className="text-pretty">
                <span className="font-medium text-foreground">{repertoire.mass.title}</span>
                <span className="block text-sm first-letter:uppercase">{formatLongDate(repertoire.mass.date)}</span>
                <Link
                  href={`/preparar-missa?data=${repertoire.mass.date}${repertoire.mass.celebrationId ? `&celebracao=${encodeURIComponent(repertoire.mass.celebrationId)}` : ""}&repertorio=${repertoire.id}`}
                  className="mt-1 inline-block text-sm font-medium text-foreground underline underline-offset-3"
                >
                  Ver a celebração e as sugestões
                </Link>
              </p>
            )}
            {repertoire.mass && <MassCelebrationStatus mass={repertoire.mass} repertoireId={repertoire.id} />}
            {repertoire.description && <p className="text-pretty">{repertoire.description}</p>}
            <p className="mt-2 text-sm">{formatSongCount(entries.length)}</p>
          </>
        }
        actions={
          <>
            <Link
              href={`/repertorios/${repertoire.id}/compartilhar`}
              className={cn(buttonVariants({ size: "lg" }))}
            >
              <Share2 data-icon="inline-start" aria-hidden />
              Compartilhar repertório
            </Link>
            {entries.length > 0 && (
              <PrintMenu
                options={[
                  { label: "Imprimir letras", href: `/repertorios/${repertoire.id}/imprimir?formato=letras` },
                  { label: "Imprimir cifras", href: `/repertorios/${repertoire.id}/imprimir?formato=cifras` },
                ]}
              />
            )}
            <Link
              href={`/repertorios/${repertoire.id}/editar`}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              <Pencil data-icon="inline-start" aria-hidden />
              Editar
            </Link>
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="lg">
                  <Trash2 data-icon="inline-start" aria-hidden />
                  Excluir
                </Button>
              }
              title={`Excluir “${repertoire.name}”?`}
              description="O repertório será removido da sua conta, e todos os links públicos dele serão revogados na mesma operação. As músicas continuam na biblioteca. Esta ação não pode ser desfeita."
              confirmLabel="Excluir repertório"
              onConfirm={onDelete}
            />
          </>
        }
      />

      <AddSongToRepertoire repertoire={repertoire} songs={songs} />
      <RepertoireEntryList
        repertoireId={repertoire.id}
        revision={repertoire.revision}
        entries={entries}
        forMass={repertoire.mass !== undefined}
      />
    </>
  );
}

export function RepertoireDetailScreen({ repertoireId }: { repertoireId: RepertoireId }) {
  const router = useRouter();
  // Evita mostrar "não encontrado" entre a exclusão e a chegada à listagem.
  const [leaving, setLeaving] = useState(false);

  /** Com a revisão em tela: uma versão alterada em outro lugar exige nova confirmação. */
  async function handleDelete(revision: number): Promise<void> {
    setLeaving(true);
    try {
      await repertoireRepository.delete(repertoireId, revision);
    } catch (error) {
      setLeaving(false);
      throw error;
    }
    showToast("Repertório excluído.");
    router.replace("/repertorios");
  }

  return (
    <LibraryGate>
      {({ songs, repertoires, catalogSongs }) => {
        const repertoire = repertoires.find((candidate) => candidate.id === repertoireId);

        if (!repertoire) {
          return leaving ? <PageSkeleton /> : <RepertoireNotFound />;
        }

        return (
          <RepertoireDetail
            repertoire={repertoire}
            songs={songs}
            catalogSongs={catalogSongs}
            onDelete={() => handleDelete(repertoire.revision)}
          />
        );
      }}
    </LibraryGate>
  );
}
