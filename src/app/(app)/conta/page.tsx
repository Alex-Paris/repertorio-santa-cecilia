import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { AccountScreen } from "@/features/auth/components/account-screen";

export const metadata: Metadata = { title: "Minha conta", robots: { index: false } };

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Minha conta" />
      <Suspense fallback={<ContentSkeleton />}>
        <AccountScreen />
      </Suspense>
    </>
  );
}
