import { cn } from "cn";
import { Music } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { buttonVariants } from "@/components/ui/button";

export function SongNotFound() {
  return (
    <EmptyState
      icon={Music}
      title="Música não encontrada"
      description="Esta música não existe na sua biblioteca."
      action={
        <Link href="/biblioteca" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Ir para a biblioteca
        </Link>
      }
    />
  );
}
