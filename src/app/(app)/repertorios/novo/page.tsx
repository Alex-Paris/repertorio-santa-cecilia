import type { Metadata } from "next";

import { RepertoireFormScreen } from "@/features/repertoires/components/repertoire-form-screen";

export const metadata: Metadata = { title: "Novo repertório" };

export default function NewRepertoirePage() {
  return <RepertoireFormScreen />;
}
