import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { SignUpScreen } from "@/features/auth/components/sign-up-screen";

export const metadata: Metadata = { title: "Criar conta", robots: { index: false } };

export default function SignUpPage() {
  return (
    <>
      <PageHeader title="Criar conta" />
      <Suspense fallback={<ContentSkeleton />}>
        <SignUpScreen />
      </Suspense>
    </>
  );
}
