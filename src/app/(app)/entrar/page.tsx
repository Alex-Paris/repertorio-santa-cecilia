import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { SignInScreen } from "@/features/auth/components/sign-in-screen";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="py-4 md:py-8">
      <section className="surface-panel mx-auto w-full max-w-md p-5 sm:p-8" aria-label="Acessar sua conta">
        <PageHeader title="Entrar" description="Acesse sua conta para organizar suas músicas e repertórios." />
        <Suspense fallback={<ContentSkeleton />}><SignInScreen searchParams={searchParams} /></Suspense>
      </section>
    </div>
  );
}
