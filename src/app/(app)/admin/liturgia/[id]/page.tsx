import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { CelebrationAdminScreen } from "@/features/liturgy/components/admin/celebration-admin";
import { requireCatalogAdminPage } from "@/server/catalog/admin-page";

export const metadata: Metadata = { title: "Revisar celebração", robots: { index: false } };

async function Gate({ params }: { params: Promise<{ id: string }> }) {
  const [userId, { id }] = await Promise.all([requireCatalogAdminPage(), params]);
  return <CelebrationAdminScreen key={id} userId={userId} celebrationId={id} />;
}

export default function CelebrationAdminPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <PageHeader title="Revisar celebração" back={{ href: "/admin/liturgia", label: "Administrar liturgia" }} />
      <Suspense fallback={<ContentSkeleton />}>
        <Gate params={params} />
      </Suspense>
    </>
  );
}
