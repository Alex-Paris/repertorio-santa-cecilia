import type { Metadata } from "next";
import { Suspense } from "react";

import { FormError } from "@/components/layout/form-error";
import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { MySubmissionDetail } from "@/features/contributions/components/my-submissions";
import { requireUserPage } from "@/server/auth/require-user-page";

export const metadata: Metadata = { title: "Sugestão", robots: { index: false } };

async function Gate({ params }: { params: Promise<{ id: string }> }) {
  const [userId, { id }] = await Promise.all([requireUserPage(), params]);
  return userId ? (
    <MySubmissionDetail key={id} userId={userId} submissionId={id} />
  ) : (
    <FormError message="O serviço de contas está indisponível no momento." />
  );
}

export default function MySubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <PageHeader title="Sugestão para o catálogo" back={{ href: "/conta/sugestoes", label: "Minhas sugestões" }} />
      <Suspense fallback={<ContentSkeleton />}>
        <Gate params={params} />
      </Suspense>
    </>
  );
}
