"use client";

import { cn } from "cn";
import Link from "next/link";

import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { buttonVariants } from "@/components/ui/button";

import { HomeOverview } from "./home-overview";
import { useLibrary } from "./use-library";

/**
 * Parte pessoal da página inicial, no painel "Seus repertórios". A consulta é pública: quem não entrou vê só um convite
 * discreto, e nada da conta aparece antes do login.
 */
export function HomePersonal() {
  const { status } = useLibrary();

  if (status === "loading") {
    return <ContentSkeleton />;
  }

  if (status === "signed-out") {
    return (
      <div>
        <p className="text-sm text-pretty">
          Entre para salvar repertórios, escolher o tom de cada música e compartilhar com o grupo. Consultar
          celebrações e cifras não exige conta.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/entrar" className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}>
            Entrar
          </Link>
          <Link href="/cadastro" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}>
            Criar conta
          </Link>
        </div>
      </div>
    );
  }

  return <HomeOverview />;
}
