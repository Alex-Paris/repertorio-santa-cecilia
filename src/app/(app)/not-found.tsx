import { Compass } from "lucide-react";
import type { Metadata } from "next";
import { cn } from "cn";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Página não encontrada"
      description="O endereço acessado não existe ou foi alterado."
      action={
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Voltar ao início
        </Link>
      }
    />
  );
}
