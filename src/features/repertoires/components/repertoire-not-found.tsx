import { cn } from "cn";
import { ListMusic } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { buttonVariants } from "@/components/ui/button";

export function RepertoireNotFound() {
  return (
    <EmptyState
      icon={ListMusic}
      title="Repertório não encontrado"
      description="Este repertório não existe na sua biblioteca."
      action={
        <Link href="/repertorios" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Ver repertórios
        </Link>
      }
    />
  );
}
