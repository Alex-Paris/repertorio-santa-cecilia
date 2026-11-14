import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { CelebrationCreateScreen } from "@/features/liturgy/components/admin/celebration-admin";
import { requireCatalogAdminPage } from "@/server/catalog/admin-page";

export const metadata: Metadata = { title: "Nova celebração", robots: { index: false } };

async function Gate() {
  return <CelebrationCreateScreen userId={await requireCatalogAdminPage()} />;
}

export default function NewCelebrationPage() {
  return (
    <>
      <PageHeader title="Nova celebração" back={{ href: "/admin/liturgia", label: "Administrar liturgia" }} />
      <Suspense fallback={<ContentSkeleton />}>
        <Gate />
      </Suspense>
    </>
  );
}
