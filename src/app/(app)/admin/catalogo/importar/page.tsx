import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { CatalogImport } from "@/features/catalog/components/catalog-import";
import initialCatalog from "@/features/catalog/data/catalogo-editorial-inicial.json";
import { requireCatalogAdminPage } from "@/server/catalog/admin-page";

export const metadata: Metadata = { title: "Importar metadados do catálogo", robots: { index: false } };

async function Gate() {
  // O arquivo do projeto só é oferecido depois da verificação de administração.
  return <CatalogImport userId={await requireCatalogAdminPage()} bundled={initialCatalog} />;
}

export default function CatalogImportPage() {
  return (
    <>
      <PageHeader
        title="Importar metadados"
        back={{ href: "/admin/catalogo", label: "Administrar catálogo" }}
        description="Cria rascunhos só com título, autoria, referência e fontes. Nada é publicado nem alterado sem revisão."
      />
      <Suspense fallback={<ContentSkeleton />}>
        <Gate />
      </Suspense>
    </>
  );
}
