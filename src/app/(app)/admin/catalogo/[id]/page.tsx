import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { CatalogSongEditor } from "@/features/catalog/components/catalog-admin";
import { requireCatalogAdminPage } from "@/server/catalog/admin-page";

export const metadata: Metadata = { title: "Editar música do catálogo", robots: { index: false } };

async function Gate({ params }: { params: Promise<{ id: string }> }) {
  const [userId, { id }] = await Promise.all([requireCatalogAdminPage(), params]);
  return <CatalogSongEditor key={id} userId={userId} songId={id} />;
}

export default function EditCatalogSongPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <PageHeader title="Editar música do catálogo" back={{ href: "/admin/catalogo", label: "Administrar catálogo" }} />
      <Suspense fallback={<ContentSkeleton />}>
        <Gate params={params} />
      </Suspense>
    </>
  );
}
