import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AmbientImage } from "@/components/brand/ambient-image";
import { PageHeader } from "@/components/layout/page-header";

export function AuthLayout({ title, description, label, children }: { title:string; description:string; label:string; children:ReactNode }) {
  return <div data-layout="wide" className="auth-page"><div className="auth-layout">
    <aside className="auth-art" aria-label="Santa Cecília">
      <div className="auth-art-picture"><AmbientImage image="santa-cecilia-igreja" sizes="1200px" eager compactSaint /></div>
      <div className="auth-art-copy"><span className="text-xs font-semibold tracking-wider text-gold-strong uppercase">Santa Cecília</span>
        <h2>Um lugar para a música da sua comunidade.</h2><p>Do primeiro ensaio à celebração.</p>
      </div>
    </aside>
    <section className="auth-content" aria-label={label}>
      <Link href="/" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Voltar ao início</Link>
      <PageHeader title={title} description={description} />{children}
    </section>
  </div></div>;
}
