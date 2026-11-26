import type { Metadata } from "next";

import { AmbientImage } from "@/components/brand/ambient-image";
import { AMBIENT_IMAGES } from "@/components/brand/ambient-images";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title:"Créditos das imagens" };

export default function ImageCreditsPage() {
  return <div className="space-y-6">
    <PageHeader title="Créditos das imagens" description="Origem, autoria e licença dos recursos visuais do Repertório Santa Cecília." />
    {Object.values(AMBIENT_IMAGES).map(asset => <section key={asset.id} id={asset.id} className="scroll-mt-24 rounded-2xl border bg-card p-5 sm:flex sm:items-start sm:gap-6">
      <div className="mb-4 h-40 w-full shrink-0 rounded-xl bg-secondary sm:mb-0 sm:w-52"><AmbientImage image={asset.id} sizes="240px" className="h-40 w-full object-contain" /></div>
      <div className="min-w-0 space-y-2"><h2 className="text-xl font-semibold">{asset.title}</h2>
        <p className="text-sm text-muted-foreground">{asset.author}</p>
        <p className="text-sm">{asset.license}</p>
        {asset.source.startsWith("https://") && <a href={asset.source} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">Origem no Wikimedia Commons<span className="sr-only"> (abre em outra aba)</span></a>}
        {"licenseUrl" in asset && <a href={asset.licenseUrl} target="_blank" rel="noopener noreferrer" className="ml-4 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">Licença<span className="sr-only"> (abre em outra aba)</span></a>}
        <p className="text-xs text-muted-foreground">Imagem redimensionada e comprimida em WebP, com enquadramento responsivo por CSS.</p>
        {asset.id === "quaresma" && <p className="text-xs text-muted-foreground">High Altar in Lent — Elapl / Wikimedia Commons — CC BY-SA 4.0. As variantes e os enquadramentos desta imagem conservam a mesma licença.</p>}
      </div>
    </section>)}
  </div>;
}
