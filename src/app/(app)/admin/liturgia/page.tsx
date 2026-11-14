import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { LiturgyAdminList } from "@/features/liturgy/components/admin/celebration-admin";
import { requireCatalogAdminPage } from "@/server/catalog/admin-page";

export const metadata: Metadata = { title: "Administrar liturgia", robots: { index: false } };

async function Gate() {
  return <LiturgyAdminList userId={await requireCatalogAdminPage()} />;
}

export default function LiturgyAdminPage() {
  return (
    <>
      <PageHeader
        title="Administrar liturgia"
        description="Celebrações do calendário, fontes, revisão editorial e histórico."
      />
      <Suspense fallback={<ContentSkeleton />}>
        <Gate />
      </Suspense>
    </>
  );
}
