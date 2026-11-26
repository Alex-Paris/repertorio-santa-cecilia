"use client";

import type { ReactNode } from "react";
import type { CatalogSongView } from "@/features/library/domain/library";
import { useDocumentTitle } from "@/lib/utils/use-document-title";

import { CatalogSongDetail } from "./catalog-song-detail";

/** Leitura pública em página própria. O tom ajustado aqui é só desta visita: a música do catálogo nunca muda. */
interface CatalogSongScreenProps {
  song: CatalogSongView;
  repertoirePanel?: ReactNode;
  /** De onde a pessoa veio; por padrão, o catálogo. */
  back?: { href: string; label: string };
  /** Repertório atual do painel ao lado, quando houver. */
  currentRepertoire?: { repertoireId: string | null };
}

export function CatalogSongScreen({ song, back = { href: "/catalogo", label: "Catálogo" }, currentRepertoire, repertoirePanel }: CatalogSongScreenProps) {
  useDocumentTitle(song.title);
  return <CatalogSongDetail song={song} back={back} currentRepertoire={currentRepertoire} repertoirePanel={repertoirePanel} />;
}
