import { headers } from "next/headers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { FormError } from "@/components/layout/form-error";
import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { MigrationScreen } from "@/features/library/components/migration-screen";
import { lookupSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Importar biblioteca antiga", robots: { index: false } };

async function MigrationGate() {
  const lookup = await lookupSession(await headers());

  if (lookup.status === "anonymous") {
    redirect("/entrar");
  }
  if (lookup.status === "unavailable") {
    return <FormError message="O serviço de contas está indisponível no momento." />;
  }

  return <MigrationScreen userId={lookup.session.user.id} />;
}

export default function LegacyImportPage() {
  return (
    <>
      <PageHeader
        title="Importar biblioteca antiga"
        description="Versões anteriores guardavam músicas neste navegador. Revise o conteúdo antes de copiá-lo para a sua conta."
        back={{ href: "/conta", label: "Minha conta" }}
      />
      <Suspense fallback={<ContentSkeleton />}>
        <MigrationGate />
      </Suspense>
    </>
  );
}
