import type { Metadata } from "next";

import { RepertoireFormScreen } from "@/features/repertoires/components/repertoire-form-screen";

interface EditRepertoirePageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Editar repertório", robots: { index: false } };

export default async function EditRepertoirePage({ params }: EditRepertoirePageProps) {
  const { id } = await params;
  return <RepertoireFormScreen repertoireId={id} />;
}
