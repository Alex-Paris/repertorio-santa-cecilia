import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { PersonalSongPrintScreen } from "@/features/printing/components/print-screens";
import { parsePrintFormat, parseSemitones } from "@/features/printing/domain/print-model";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modo?: string | string[]; tom?: string | string[] }>;
}

export const metadata: Metadata = { title: "Imprimir música", robots: { index: false } };

async function Gate({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return (
    <PersonalSongPrintScreen
      key={id}
      songId={id}
      initialFormat={parsePrintFormat(query.modo, "chords")}
      semitones={parseSemitones(query.tom)}
    />
  );
}

export default function SongPrintPage(props: PageProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Gate {...props} />
    </Suspense>
  );
}
