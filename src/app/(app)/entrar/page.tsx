import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthLayout } from "@/features/auth/components/auth-layout";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { SignInScreen } from "@/features/auth/components/sign-in-screen";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <AuthLayout title="Entrar" description="Acesse sua conta para organizar suas músicas e repertórios." label="Acessar sua conta">
      <Suspense fallback={<ContentSkeleton />}><SignInScreen searchParams={searchParams} /></Suspense>
    </AuthLayout>
  );
}
