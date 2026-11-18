import { ExternalLink } from "lucide-react";
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

interface PublicShareViewProps {
  token: string;
  share: PublicShareSnapshot;
}

export function PublicShareView({ token, share }: PublicShareViewProps) {
  return (
    <>
      <PageHeader
        title={share.name}
        description={
          <>
            {share.mass && (
              <p className="text-pretty">
                <span className="font-medium text-foreground">{share.mass.title}</span>
                {share.mass.date && (
                  <span className="block text-sm first-letter:uppercase">{formatLongDate(share.mass.date)}</span>
                )}
              </p>
            )}
            {share.description && <p className="text-pretty">{share.description}</p>}
            <p className="mt-2 text-sm">{formatSongCount(share.items.length)}</p>
          </>
        }
        actions={
          share.items.length > 0 ? (
            <PrintMenu
              options={[
                { label: "Imprimir letras", href: `/s/${token}/imprimir?formato=letras` },
                { label: "Imprimir cifras", href: `/s/${token}/imprimir?formato=cifras` },
              ]}
            />
          ) : undefined
        }
      />

      <ol className="divide-y rounded-xl border bg-card">
        {share.items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <span className="w-6 shrink-0 text-sm text-muted-foreground tabular-nums">{item.position}</span>
            <Link href={`/s/${token}/musicas/${item.id}`} className="min-w-0 flex-1 rounded-md">
              {item.moment && (
                <span className="block text-xs text-muted-foreground">{momentLabel(item.moment)}</span>
              )}
              <span className="block font-medium wrap-break-word">{item.title}</span>
              <span className="block text-sm text-muted-foreground wrap-break-word">{item.artist}</span>
            </Link>
            {item.content.kind !== "external-link" && item.originalKey && (
              <KeyLabel musicalKey={transposeKey(item.originalKey, item.transposeSemitones)} />
            )}
            <span className="text-xs text-muted-foreground">{describeShareContent(item.content)}</span>
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
          </li>
        ))}
      </ol>
    </>
  );
}
