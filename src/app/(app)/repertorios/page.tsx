import { cn } from "cn";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { RefreshLibraryButton } from "@/features/library/components/refresh-library-button";
import { RepertoireListScreen } from "@/features/repertoires/components/repertoire-list-screen";

export const metadata: Metadata = { title: "Repertórios" };

export default function RepertoiresPage() {
  return (
    <>
      <PageHeader
        title="Repertórios"
        description="Suas listas de músicas para cada ocasião."
        actions={
          <>
            <RefreshLibraryButton />
            <Link href="/repertorios/novo" className={cn(buttonVariants({ size: "lg" }))}>
              <Plus data-icon="inline-start" aria-hidden />
              Novo repertório
            </Link>
          </>
        }
      />
      <RepertoireListScreen />
    </>
  );
}
