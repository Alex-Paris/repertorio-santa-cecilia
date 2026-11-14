import { headers } from "next/headers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { FormError } from "@/components/layout/form-error";
import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { AccountShares } from "@/features/sharing/components/account-shares";
import { lookupSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Compartilhamentos", robots: { index: false } };

async function SharesGate() {
  const lookup = await lookupSession(await headers());

  if (lookup.status === "anonymous") {
    redirect("/entrar");
  }
  if (lookup.status === "unavailable") {
    return <FormError message="O serviço de contas está indisponível no momento." />;
  }

  return <AccountShares userId={lookup.session.user.id} />;
}

export default function SharesPage() {
  return (
    <>
      <PageHeader
        title="Compartilhamentos"
        description="Links públicos ativos dos seus repertórios."
      />
      <Suspense fallback={<ContentSkeleton />}>
        <SharesGate />
      </Suspense>
    </>
  );
}
