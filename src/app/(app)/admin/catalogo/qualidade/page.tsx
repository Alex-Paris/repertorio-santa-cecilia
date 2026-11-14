import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { CatalogQualityReport } from "@/features/catalog/components/catalog-quality";
import { requireCatalogAdminPage } from "@/server/catalog/admin-page";

export const metadata: Metadata = { title: "Qualidade da classificação", robots: { index: false } };

async function Gate() {
  return <CatalogQualityReport userId={await requireCatalogAdminPage()} />;
}

export default function CatalogQualityPage() {
  return (
    <>
      <PageHeader
        title="Qualidade da classificação"
        back={{ href: "/admin/catalogo", label: "Administrar catálogo" }}
        description="Músicas que ainda não recebem sugestões litúrgicas, e por quê."
      />
      <Suspense fallback={<ContentSkeleton />}>
        <Gate />
      </Suspense>
    </>
  );
}
