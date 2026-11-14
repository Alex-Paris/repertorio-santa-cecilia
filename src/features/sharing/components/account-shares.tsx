"use client";

import { cn } from "cn";
import { Link2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { FormError } from "@/components/layout/form-error";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { getLibraryErrorMessage } from "@/features/library/domain/library-errors";

import { createShareApi, type ShareList } from "../data/share-api";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; list: ShareList };

/** Visão geral dos links da conta; cada repertório tem sua própria tela de gerenciamento. */
export function AccountShares({ userId }: { userId: string }) {
  const api = useMemo(() => createShareApi(userId), [userId]);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    api.listAll().then(
      (list) => {
        if (active) {
          setState({ status: "ready", list });
        }
      },
      (error: unknown) => {
        if (active) {
          setState({ status: "error", message: getLibraryErrorMessage(error) });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [api]);

  if (state.status === "loading") {
    return <ContentSkeleton />;
  }
  if (state.status === "error") {
    return <FormError message={state.message} />;
  }

  const { enabled, shares } = state.list;

  if (shares.length === 0) {
    return (
      <EmptyState
        icon={Link2}
        title="Nenhum link público"
        description={
          enabled
            ? "Abra um repertório e escolha “Compartilhar repertório” para criar um link."
            : "O compartilhamento público não está ativado neste ambiente."
        }
      />
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card px-4">
      {shares.map((share) => (
        <li key={share.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="min-w-0">
            <p className="font-medium wrap-break-word">{share.name}</p>
            <p className="text-sm text-muted-foreground">
              Publicado em {new Date(share.publishedAt).toLocaleDateString("pt-BR")}
              {(share.outdated || share.removedTitles.length > 0) && " · difere da biblioteca"}
            </p>
          </div>
          <Link
            href={`/repertorios/${encodeURIComponent(share.repertoireId)}/compartilhar`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Gerenciar
          </Link>
        </li>
      ))}
    </ul>
  );
}
