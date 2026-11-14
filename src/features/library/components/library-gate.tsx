"use client";

import { Fragment, useState, type ReactNode } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";

import type { Library } from "../domain/library";
import {
  DraftHoldNotice,
  RemoteLibraryError,
  SignedOutLibrary,
  StaleLibraryNotice,
} from "./remote-library-states";
import { useDraftHold, useLibrary } from "./use-library";

interface LibraryGateProps {
  fallback?: ReactNode;
  children: (library: Library) => ReactNode;
}

/** Trata em um só lugar carregamento, ausência de sessão e indisponibilidade da biblioteca. */
export function LibraryGate({ fallback = <PageSkeleton />, children }: LibraryGateProps) {
  const snapshot = useLibrary();
  const hold = useDraftHold();
  const [heldLibrary, setHeldLibrary] = useState<Library | null>(null);

  const library = snapshot.status === "ready" ? snapshot.library : null;

  // Guarda a última leitura só enquanto ela puder ser necessária para manter um rascunho.
  if (library ? library !== heldLibrary : heldLibrary !== null && !hold) {
    setHeldLibrary(library);
  }

  if (hold && heldLibrary && !library) {
    return renderLibrary(<DraftHoldNotice hold={hold} />, heldLibrary, children);
  }

  switch (snapshot.status) {
    case "loading":
      return fallback;
    case "signed-out":
      return <SignedOutLibrary />;
    case "remote-error":
      return <RemoteLibraryError reason={snapshot.reason} />;
    case "ready":
      return renderLibrary(snapshot.stale && <StaleLibraryNotice />, snapshot.library, children);
  }
}

/** A mesma estrutura nos dois casos: é ela que mantém um formulário montado ao perder a sessão. */
function renderLibrary(
  notice: ReactNode,
  library: Library,
  children: (library: Library) => ReactNode,
) {
  return (
    <>
      {notice}
      <Fragment key="library">{children(library)}</Fragment>
    </>
  );
}
