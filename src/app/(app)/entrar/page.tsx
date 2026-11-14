import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { SignInScreen } from "@/features/auth/components/sign-in-screen";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default function SignInPage() {
  return (
    <>
      <PageHeader title="Entrar" description="Acesse sua conta." />
      <Suspense fallback={<ContentSkeleton />}>
        <SignInScreen />
      </Suspense>
    </>
  );
}
