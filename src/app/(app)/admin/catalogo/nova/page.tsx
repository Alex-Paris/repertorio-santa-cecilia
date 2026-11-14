import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { CatalogSongEditor } from "@/features/catalog/components/catalog-admin";
import { requireCatalogAdminPage } from "@/server/catalog/admin-page";

export const metadata: Metadata = { title: "Nova música do catálogo", robots: { index: false } };

async function Gate() {
  return <CatalogSongEditor userId={await requireCatalogAdminPage()} />;
}

export default function NewCatalogSongPage() {
  return (
    <>
      <PageHeader title="Nova música do catálogo" back={{ href: "/admin/catalogo", label: "Administrar catálogo" }} />
      <Suspense fallback={<ContentSkeleton />}>
        <Gate />
      </Suspense>
    </>
  );
}
