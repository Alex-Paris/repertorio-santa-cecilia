import type { Metadata } from "next";
import { Suspense } from "react";

import { FormError } from "@/components/layout/form-error";
import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { MySubmissions } from "@/features/contributions/components/my-submissions";
import { requireUserPage } from "@/server/auth/require-user-page";

export const metadata: Metadata = { title: "Minhas sugestões", robots: { index: false } };

async function Gate() {
  const userId = await requireUserPage();
  return userId ? <MySubmissions userId={userId} /> : <FormError message="O serviço de contas está indisponível no momento." />;
}

export default function MySubmissionsPage() {
  return (
    <>
      <PageHeader
        title="Minhas sugestões"
        back={{ href: "/conta", label: "Minha conta" }}
        description="Músicas que você sugeriu para o catálogo. Elas continuam particulares na sua biblioteca."
      />
      <Suspense fallback={<ContentSkeleton />}>
        <Gate />
      </Suspense>
    </>
  );
}
