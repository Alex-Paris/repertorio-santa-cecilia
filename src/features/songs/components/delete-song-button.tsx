"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { MENU_ITEM_CLASS } from "@/components/layout/more-actions-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Repertoire } from "@/features/repertoires/domain/repertoire";

import type { Song } from "../domain/song";

/** Botão comum ou item do menu "Mais"; o nome acessível é o mesmo nos dois. */
function deleteTrigger(asMenuItem: boolean) {
  return asMenuItem ? (
    <button type="button" className={MENU_ITEM_CLASS}>
      <Trash2 aria-hidden />
      Excluir
    </button>
  ) : (
    <Button variant="outline" size="lg">
      <Trash2 data-icon="inline-start" aria-hidden />
      Excluir
    </Button>
  );
}

function SongInUseDialog({ song, usedBy, trigger }: { song: Song; usedBy: readonly Repertoire[]; trigger: ReturnType<typeof deleteTrigger> }) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Esta música não pode ser excluída</AlertDialogTitle>
          <AlertDialogDescription>
            “{song.title}” faz parte dos repertórios abaixo. Remova-a de cada um deles para poder
            excluí-la.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="space-y-1 text-sm">
          {usedBy.map((repertoire) => (
            <li key={repertoire.id}>
              <Link
                href={`/repertorios/${repertoire.id}`}
                className="underline underline-offset-3"
                onClick={() => setOpen(false)}
              >
                {repertoire.name}
              </Link>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel size="lg">Entendi</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteSongButtonProps {
  song: Song;
  usedBy: readonly Repertoire[];
  onConfirm: () => Promise<void>;
  /** Aviso sobre uma sugestão ao catálogo feita a partir desta música. */
  contributionNotice?: string;
  /** Dentro do menu "Mais" da página da música. */
  asMenuItem?: boolean;
}

export function DeleteSongButton({ song, usedBy, onConfirm, contributionNotice, asMenuItem = false }: DeleteSongButtonProps) {
  const trigger = deleteTrigger(asMenuItem);
  if (usedBy.length > 0) {
    return <SongInUseDialog song={song} usedBy={usedBy} trigger={trigger} />;
  }

  return (
    <ConfirmDialog
      trigger={trigger}
      title={`Excluir “${song.title}”?`}
      description={`A música e sua cifra serão removidas da sua biblioteca. Esta ação não pode ser desfeita.${contributionNotice ? ` ${contributionNotice}` : ""}`}
      confirmLabel="Excluir música"
      onConfirm={onConfirm}
    />
  );
}
