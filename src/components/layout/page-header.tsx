import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}

export function PageHeader({ title, description, back, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 md:mb-8">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      {/*
        Título e ações lado a lado só quando cabem: o título tem uma largura mínima (20rem) e, sem
        espaço, as ações descem para a linha de baixo em vez de espremer ou cobrir o título.
      */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-[1_1_20rem]">
          <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-balance text-heading md:text-4xl">{title}</h1>
          {description && <div className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">{description}</div>}
        </div>
        {actions && <div className="flex max-w-full flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
