import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { SignUpScreen } from "@/features/auth/components/sign-up-screen";

export const metadata: Metadata = { title: "Criar conta", robots: { index: false } };

export default function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="py-4 md:py-8">
      <section className="surface-panel mx-auto w-full max-w-md p-5 sm:p-8" aria-label="Cadastro de conta">
        <PageHeader title="Criar conta" description="Guarde suas músicas e prepare seus repertórios em um só lugar." />
        <Suspense fallback={<ContentSkeleton />}><SignUpScreen searchParams={searchParams} /></Suspense>
      </section>
    </div>
  );
}
