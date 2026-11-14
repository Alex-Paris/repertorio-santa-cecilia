"use client";

import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { LibraryGate } from "@/features/library/components/library-gate";

import type { RepertoireId } from "../domain/repertoire";
import { RepertoireForm } from "./repertoire-form";
import { RepertoireNotFound } from "./repertoire-not-found";

/** Cria um repertório ou, com `repertoireId`, edita o existente. */
export function RepertoireFormScreen({ repertoireId }: { repertoireId?: RepertoireId }) {
  // Novas navegações abrem o formulário limpo; voltar e avançar preservam o rascunho.
  const { bfcacheId } = useRouter();

  return (
    <LibraryGate>
      {({ repertoires }) => {
        if (!repertoireId) {
          return (
            <>
              <PageHeader
                title="Novo repertório"
                back={{ href: "/repertorios", label: "Repertórios" }}
              />
              <RepertoireForm key={bfcacheId} />
            </>
          );
        }

        const repertoire = repertoires.find((candidate) => candidate.id === repertoireId);
        if (!repertoire) {
          return <RepertoireNotFound />;
        }

        return (
          <>
            <PageHeader
              title="Editar repertório"
              back={{ href: `/repertorios/${repertoire.id}`, label: repertoire.name }}
            />
            <RepertoireForm key={bfcacheId} repertoire={repertoire} />
          </>
        );
      }}
    </LibraryGate>
  );
}
