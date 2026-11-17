import type { Metadata } from "next";
import { Suspense } from "react";

import { FormError } from "@/components/layout/form-error";
import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { SubmissionForm } from "@/features/contributions/components/submission-form";
import { requireUserPage } from "@/server/auth/require-user-page";

export const metadata: Metadata = { title: "Sugerir para o catálogo", robots: { index: false } };

// O identificador vem da URL: lido dentro do Suspense, como a sessão.
async function Gate({ params }: { params: Promise<{ id: string }> }) {
  const [userId, { id }] = await Promise.all([requireUserPage(), params]);
  return (
    <>
      <PageHeader
        title="Sugerir para o catálogo"
        back={{ href: `/musicas/${encodeURIComponent(id)}`, label: "Voltar à música" }}
        description="A equipe do catálogo analisa cada sugestão antes de qualquer publicação."
      />
      {userId ? (
        <SubmissionForm key={id} userId={userId} songId={id} />
      ) : (
        <FormError message="O serviço de contas está indisponível no momento." />
      )}
    </>
  );
}

export default function SuggestSongPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <Gate params={params} />
    </Suspense>
  );
}
