import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthLayout } from "@/features/auth/components/auth-layout";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { SignUpScreen } from "@/features/auth/components/sign-up-screen";

export const metadata: Metadata = { title: "Criar conta", robots: { index: false } };

export default function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <AuthLayout title="Criar conta" description="Guarde suas músicas e prepare seus repertórios em um só lugar." label="Cadastro de conta">
      <Suspense fallback={<ContentSkeleton />}><SignUpScreen searchParams={searchParams} /></Suspense>
    </AuthLayout>
  );
}
