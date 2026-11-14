import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";

import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { RefreshLibraryButton } from "@/features/library/components/refresh-library-button";
import { SongLibraryScreen } from "@/features/songs/components/song-library-screen";

export const metadata: Metadata = { title: "Músicas" };

export default function LibraryPage() {
  return (
    <>
      <PageHeader
        title="Músicas"
        description="Todas as músicas da sua coleção pessoal."
        actions={
          <>
          <RefreshLibraryButton />
          <Link href="/musicas/nova" className={cn(buttonVariants({ size: "lg" }))}>
            <Plus data-icon="inline-start" aria-hidden />
            Nova música
          </Link>
          </>
        }
      />
      <SongLibraryScreen />
    </>
  );
}
