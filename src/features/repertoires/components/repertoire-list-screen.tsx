"use client";

import { cn } from "cn";
import { ListMusic } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { LibraryGate } from "@/features/library/components/library-gate";
import { todayInBrazil } from "@/features/liturgy/domain/calendar";

import type { Repertoire } from "../domain/repertoire";
import { groupRepertoiresForList } from "../services/repertoire-list";
import { RepertoireCard } from "./repertoire-card";

function Group({ id, title, repertoires }: { id: string; title?: string; repertoires: Repertoire[] }) {
  if (repertoires.length === 0) return null;
  return (
    <section aria-labelledby={title ? id : undefined}>
      {title && (
        <h2 id={id} className="mb-2 text-sm font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {title}
        </h2>
      )}
      <ul className="space-y-3">
        {repertoires.map((repertoire) => (
          <RepertoireCard key={repertoire.id} repertoire={repertoire} />
        ))}
      </ul>
    </section>
  );
}

/** Próximas missas primeiro; os títulos dos grupos só aparecem quando há os dois. */
function GroupedList({ repertoires }: { repertoires: readonly Repertoire[] }) {
  const { upcoming, others } = groupRepertoiresForList(repertoires, todayInBrazil());
  const titled = upcoming.length > 0 && others.length > 0;
  return (
    <div className="space-y-6">
      <Group id="proximas-missas" title={titled ? "Próximas missas" : undefined} repertoires={upcoming} />
      <Group id="outros-repertorios" title={titled ? "Outros repertórios" : undefined} repertoires={others} />
    </div>
  );
}

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
          <GroupedList repertoires={repertoires} />
        )
      }
    </LibraryGate>
  );
}
