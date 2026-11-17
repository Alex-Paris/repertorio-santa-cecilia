import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { SubmissionQueue } from "@/features/contributions/components/submission-review";
import { requireCatalogAdminPage } from "@/server/catalog/admin-page";

export const metadata: Metadata = { title: "Contribuições", robots: { index: false } };

async function Gate() {
  return <SubmissionQueue userId={await requireCatalogAdminPage()} />;
}

export default function ContributionsAdminPage() {
  return (
    <>
      <PageHeader title="Contribuições" description="Sugestões de músicas enviadas pelas contas, para revisão antes de qualquer publicação." />
      <Suspense fallback={<ContentSkeleton />}>
        <Gate />
      </Suspense>
    </>
  );
}
