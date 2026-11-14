import { cn } from "cn";
import { ExternalLink, Link2Off } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { isSafeExternalUrl } from "@/lib/utils/is-safe-external-url";

export function ExternalSourceNotice({ sourceUrl }: { sourceUrl: string }) {
  if (!isSafeExternalUrl(sourceUrl)) {
    return (
      <EmptyState
        icon={Link2Off}
        title="Link indisponível"
        description="O endereço cadastrado para esta música não é válido."
      />
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 md:p-8">
      <h2 className="font-medium">Cifra hospedada em outro site</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Esta música é apenas um atalho para a fonte original. O conteúdo não é copiado para esta
        plataforma.
      </p>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className={cn(buttonVariants({ size: "lg" }), "mt-4 h-10 px-3")}
      >
        Abrir fonte original
        <ExternalLink data-icon="inline-end" aria-hidden />
        <span className="sr-only">(abre em nova aba)</span>
      </a>
    </div>
  );
}
