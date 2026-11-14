import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { CatalogAdminList } from "@/features/catalog/components/catalog-admin";
import { requireCatalogAdminPage } from "@/server/catalog/admin-page";

export const metadata: Metadata = { title: "Administrar catálogo", robots: { index: false } };

async function Gate() {
  return <CatalogAdminList userId={await requireCatalogAdminPage()} />;
}

export default function CatalogAdminPage() {
  return (
    <>
      <PageHeader title="Administrar catálogo" description="Rascunhos, publicações e direitos das músicas globais." />
      <Suspense fallback={<ContentSkeleton />}>
        <Gate />
      </Suspense>
    </>
  );
}
