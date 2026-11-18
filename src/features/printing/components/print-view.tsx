"use client";

import { cn } from "cn";
import { ArrowLeft, CircleAlert, Printer } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/lib/utils/use-document-title";

import {
  PRINT_FORMATS,
  summarizePrint,
  UNAVAILABLE_TEXT,
  type PrintFormat,
  type PrintItem,
} from "../domain/print-model";
import { PrintDocument } from "./print-document";

interface PrintViewProps {
  /** "Imprimir repertório" ou "Imprimir música". */
  heading: string;
  /** Nome do repertório ou título da música. */
  name: string;
  back: { href: string; label: string };
  format: PrintFormat;
  formatLabels: Record<PrintFormat, string>;
  onFormatChange: (format: PrintFormat) => void;
  items: readonly PrintItem[];
  single?: boolean;
  header?: { title: string; lines?: string[] };
  /** Linhas extras da pré-visualização (celebração, origem). */
  details?: ReactNode;
}

/**
 * Pré-visualização simples e a folha. Na tela: nome, quantidade, ordem, momentos, formato,
 * avisos de músicas sem conteúdo, Imprimir e Voltar. No papel, só a folha (`data-print-hide`
 * no resto). A impressão é a do navegador: impressora ou "Salvar como PDF".
 */
export function PrintView({
  heading,
  name,
  back,
  format,
  formatLabels,
  onFormatChange,
  items,
  single = false,
  header,
  details,
}: PrintViewProps) {
  useDocumentTitle(`${name} — ${formatLabels[format].toLowerCase()}`);
  const summary = summarizePrint(items);

  return (
    <div className="space-y-5">
      <section data-print-hide aria-labelledby="imprimir-titulo" className="space-y-4 print:hidden">
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
        <div>
          <h1 id="imprimir-titulo" className="font-display text-3xl font-semibold tracking-tight text-balance text-heading">
            {heading}
          </h1>
          <p className="mt-1 text-muted-foreground">
            <span className="font-medium text-foreground">{name}</span>
            {!single && ` · ${items.length === 1 ? "1 música" : `${items.length} músicas`}`}
          </p>
          {details}
        </div>

        {!single && items.length > 0 && (
          <ol aria-label="Ordem das músicas" className="divide-y rounded-xl border bg-card text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex items-baseline gap-3 px-3 py-2">
                <span className="w-5 shrink-0 text-right text-muted-foreground tabular-nums">{item.position}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn("font-medium", !item.moment && "text-muted-foreground")}>{item.label}</span>
                  <span className="wrap-break-word">: {item.title}</span>
                  {item.unavailable && (
                    <span className="block text-xs text-destructive">{UNAVAILABLE_TEXT[item.unavailable]}</span>
                  )}
                </span>
                {format === "chords" && item.printKey && !item.unavailable && (
                  <span className="shrink-0 font-mono text-xs font-semibold text-chord">{item.printKey}</span>
                )}
              </li>
            ))}
          </ol>
        )}

        {summary.unavailable.length > 0 && (
          <p role="status" className="flex items-start gap-2 rounded-lg border border-gold/60 bg-gold/10 px-3 py-2.5 text-sm">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-gold-strong" aria-hidden />
            {single
              ? UNAVAILABLE_TEXT[summary.unavailable[0]!.unavailable!]
              : `${summary.unavailable.length === 1 ? "1 música não tem" : `${summary.unavailable.length} músicas não têm`} letra ou cifra disponível para este formato. Elas continuam no papel, na ordem, com um aviso no lugar do conteúdo.`}
          </p>
        )}
        {!single && items.length === 0 && (
          <p className="rounded-lg border px-3 py-2.5 text-sm">Este repertório ainda não tem músicas.</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Formato" className="inline-flex rounded-lg border bg-background/60 p-0.5">
            {PRINT_FORMATS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={format === option}
                onClick={() => onFormatChange(option)}
                className="h-9 rounded-md px-3 text-sm font-medium text-muted-foreground aria-checked:bg-primary aria-checked:text-primary-foreground"
              >
                {formatLabels[option]}
              </button>
            ))}
          </div>
          <Button size="lg" onClick={() => window.print()} disabled={items.length === 0}>
            <Printer data-icon="inline-start" aria-hidden />
            Imprimir
          </Button>
          <Link href={back.href} className="text-sm font-medium underline underline-offset-3">
            Voltar
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          {format === "chords" && !single
            ? "Com cifras, cada música começa numa nova folha e continua nas seguintes, se precisar. "
            : !single
              ? "Só com as letras, as músicas seguem uma depois da outra, para gastar menos papel. "
              : ""}
          Para gerar um PDF, escolha “Salvar como PDF” no destino da impressão. Anotações particulares não são impressas.
        </p>
      </section>

      <div className="-mx-4 bg-[#e9e3d8] px-3 py-5 sm:mx-0 sm:rounded-2xl sm:px-6 dark:bg-[#0e0d09] print:m-0 print:bg-transparent print:p-0">
        <PrintDocument format={format} items={items} single={single} header={header} />
      </div>
    </div>
  );
}

/** Troca o formato sem recarregar a página e mantém a URL compartilhável. */
export function replaceSearchParam(name: string, value: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState(window.history.state, "", url);
}
