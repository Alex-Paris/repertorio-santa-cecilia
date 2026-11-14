"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ConfirmDialog } from "@/components/layout/confirm-dialog";
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

const trigger = (
  <Button variant="outline" size="lg">
    <Trash2 data-icon="inline-start" aria-hidden />
    Excluir
  </Button>
);

function SongInUseDialog({ song, usedBy }: { song: Song; usedBy: readonly Repertoire[] }) {
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
}

export function DeleteSongButton({ song, usedBy, onConfirm }: DeleteSongButtonProps) {
  if (usedBy.length > 0) {
    return <SongInUseDialog song={song} usedBy={usedBy} />;
  }

  return (
    <ConfirmDialog
      trigger={trigger}
      title={`Excluir “${song.title}”?`}
      description="A música e sua cifra serão removidas da sua biblioteca. Esta ação não pode ser desfeita."
      confirmLabel="Excluir música"
      onConfirm={onConfirm}
    />
  );
}
