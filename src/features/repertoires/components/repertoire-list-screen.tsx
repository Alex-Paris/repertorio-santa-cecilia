"use client";

import { cn } from "cn";
import { ListMusic } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { LibraryGate } from "@/features/library/components/library-gate";

import { RepertoireCard } from "./repertoire-card";

export function RepertoireListScreen() {
  return (
    <LibraryGate fallback={<ContentSkeleton />}>
      {({ repertoires }) =>
        repertoires.length === 0 ? (
          <EmptyState
            icon={ListMusic}
            title="Nenhum repertório ainda"
            description="Crie um repertório para organizar suas músicas por ocasião."
            action={
              <Link
                href="/repertorios/novo"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                Criar repertório
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {repertoires.map((repertoire) => (
              <RepertoireCard key={repertoire.id} repertoire={repertoire} />
            ))}
          </ul>
        )
      }
    </LibraryGate>
  );
}
