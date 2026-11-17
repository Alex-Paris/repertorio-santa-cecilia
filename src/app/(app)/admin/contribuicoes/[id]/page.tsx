import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { SubmissionReview } from "@/features/contributions/components/submission-review";
import { requireCatalogAdminPage } from "@/server/catalog/admin-page";

export const metadata: Metadata = { title: "Revisar contribuição", robots: { index: false } };

async function Gate({ params }: { params: Promise<{ id: string }> }) {
  const [userId, { id }] = await Promise.all([requireCatalogAdminPage(), params]);
  return <SubmissionReview key={id} userId={userId} submissionId={id} />;
}

export default function ContributionReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <PageHeader title="Revisar contribuição" back={{ href: "/admin/contribuicoes", label: "Contribuições" }} />
      <Suspense fallback={<ContentSkeleton />}>
        <Gate params={params} />
      </Suspense>
    </>
  );
}
