import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { SITE_NAME, SITE_PRIVACY_EMAIL, SITE_RESPONSIBLE_NAME, SITE_URL } from "@/lib/site";

export const LEGAL_UPDATED_AT = "2026-11-22";

export function legalMetadata(title: string, description: string, path: string): Metadata {
  return { title, description, alternates: { canonical: `${SITE_URL}${path}` }, robots: { index: true, follow: true } };
}

export function LegalDocument({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <article className="space-y-8 rounded-2xl border bg-card p-5 text-base leading-relaxed shadow-sm sm:p-7 md:p-8 [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-primary">
        <p className="text-sm text-muted-foreground">
          {SITE_NAME} · Atualizado em <time dateTime={LEGAL_UPDATED_AT}>22 de novembro de 2026</time>
        </p>
        {children}
      </article>
    </>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="font-display text-2xl font-semibold text-heading">{title}</h2>
      {children}
    </section>
  );
}

export function LegalContact({ subject }: { subject: string }) {
  const href = `mailto:${SITE_PRIVACY_EMAIL}?subject=${encodeURIComponent(`${subject} — ${SITE_NAME}`)}`;
  return (
    <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
      <dl className="space-y-2">
        <div><dt className="text-sm text-muted-foreground">Responsável pelo site e pelo atendimento</dt><dd className="font-medium">{SITE_RESPONSIBLE_NAME}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Canal de privacidade e suporte</dt><dd className="wrap-anywhere"><a href={`mailto:${SITE_PRIVACY_EMAIL}`}>{SITE_PRIVACY_EMAIL}</a></dd></div>
      </dl>
      <a href={href} className="inline-flex min-h-11 items-center rounded-lg border border-primary/40 px-4 py-2 font-medium text-primary">
        Preparar solicitação por e-mail
      </a>
      <p className="text-sm text-muted-foreground">
        O link abre seu aplicativo de e-mail. A solicitação só é enviada quando você confirma o envio nele; esta página não envia nem registra pedidos automaticamente.
      </p>
    </div>
  );
}
