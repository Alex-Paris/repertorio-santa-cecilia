import { ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { PrintMenu } from "@/features/printing/components/print-menu";
import { formatLongDate } from "@/features/liturgy/domain/calendar";
import { momentLabel } from "@/features/liturgy/domain/vocabulary";
import { KeyLabel } from "@/features/songs/components/key-label";
import { formatSongCount } from "@/features/songs/domain/song";
import { transposeKey } from "@/features/songs/domain/transposition";

import type { PublicShareSnapshot } from "../domain/public-share";
import { describeShareContent } from "./share-item-status";
import { SharedRepertoireMenu } from "./clone-shared-repertoire";

interface PublicShareViewProps {
  token: string;
  share: PublicShareSnapshot;
}

export function PublicShareView({ token, share }: PublicShareViewProps) {
  return (
    <>
      <PageHeader
        title={share.name}
        back={{ href: "/repertorios", label: "Repertórios" }}
        description={
          <>
            {share.mass && (
              <p className="text-pretty">
                <span className="font-medium text-foreground">{share.mass.title}</span>
                {share.mass.date && <><span aria-hidden className="hidden text-sm sm:inline"> · </span><span className="block text-sm first-letter:uppercase sm:inline-block">{formatLongDate(share.mass.date)}</span></>}
              </p>
            )}
            {share.description && <p className="text-pretty">{share.description}</p>}
          </>
        }
        actions={
          <>
          {share.items.length > 0 && (
            <PrintMenu
              options={[
                { label: "Imprimir letras", href: `/s/${token}/imprimir?formato=letras` },
                { label: "Imprimir cifras", href: `/s/${token}/imprimir?formato=cifras` },
              ]}
            />
          )}
          <SharedRepertoireMenu token={token} />
          </>
        }
      />

      <section aria-labelledby="musicas-do-repertorio">
      <h2 id="musicas-do-repertorio" className="mb-2 flex items-baseline gap-2 font-display text-lg font-semibold text-heading">Músicas<span className="font-sans text-sm font-normal text-muted-foreground">{formatSongCount(share.items.length)}</span></h2>
      <ol className="divide-y overflow-hidden rounded-xl border bg-card">
        {share.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <span className="w-5 shrink-0 text-right font-mono text-sm text-muted-foreground tabular-nums">{item.position}</span>
            <Link href={`/s/${token}/musicas/${item.id}`} className="min-w-0 flex-1 rounded-md hover:underline">
              {item.moment && (
                <span className="block text-xs text-muted-foreground">{momentLabel(item.moment)}</span>
              )}
              <span className="block font-medium wrap-break-word">{item.title}</span>
              <span className="block text-sm text-muted-foreground wrap-break-word">{item.artist}</span>
            </Link>
            {item.content.kind !== "external-link" && item.originalKey && (
              <KeyLabel musicalKey={transposeKey(item.originalKey, item.transposeSemitones)} />
            )}
            {item.content.kind !== "chordpro" && <span className="text-xs text-muted-foreground">{describeShareContent(item.content)}</span>}
            {item.content.kind === "external-link" && (
              <a
                href={item.content.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="inline-flex items-center gap-1 text-sm underline underline-offset-3"
              >
                Fonte original
                <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            )}
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </li>
        ))}
      </ol>
      </section>
    </>
  );
}
