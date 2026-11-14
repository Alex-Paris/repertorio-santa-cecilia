import { cn } from "cn";
import { CloudOff, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { CelebrationList } from "@/features/liturgy/components/celebration-picker";
import { REVIEW_STATUS_LABELS, REVIEW_STATUSES, isValidIsoDate, type CelebrationQuery } from "@/features/liturgy/domain/calendar";
import { celebrationQuerySchema } from "@/features/liturgy/domain/celebration-query";
import { LITURGICAL_SEASONS } from "@/features/liturgy/domain/vocabulary";
import { searchCelebrations } from "@/server/liturgy/liturgy-service";

export const metadata: Metadata = {
  title: "Celebrações",
  description: "Celebrações cadastradas na base editorial do Repertório Web, com o estado de revisão de cada uma.",
};

interface CelebrationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 12;

/** Parâmetros em português no endereço; valores inválidos são ignorados, não viram erro na tela. */
function readQuery(raw: Record<string, string | string[] | undefined>): { query: CelebrationQuery; values: Record<string, string> } {
  const text = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string).trim() : "");
  const values = { q: text("q"), de: text("de"), ate: text("ate"), tempo: text("tempo"), situacao: text("situacao"), page: text("page") };
  const candidate = {
    ...(values.q ? { q: values.q.slice(0, 100) } : {}),
    ...(isValidIsoDate(values.de) ? { from: values.de } : {}),
    ...(isValidIsoDate(values.ate) ? { to: values.ate } : {}),
    ...(values.tempo ? { season: values.tempo } : {}),
    ...(values.situacao ? { status: values.situacao } : {}),
    ...(values.page ? { page: values.page } : {}),
    pageSize: PAGE_SIZE,
  };
  const parsed = celebrationQuerySchema.safeParse(candidate);
  return { query: parsed.success ? parsed.data : { page: 1, pageSize: PAGE_SIZE }, values };
}

function pageHref(values: Record<string, string>, page: number): string {
  const params = new URLSearchParams();
  for (const key of ["q", "de", "ate", "tempo", "situacao"]) {
    if (values[key]) {
      params.set(key, values[key]);
    }
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const search = params.toString();
  return search ? `/celebracoes?${search}` : "/celebracoes";
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass = "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 text-base md:text-sm";

function SearchForm({ values }: { values: Record<string, string> }) {
  return (
    <form action="/celebracoes" role="search" className="space-y-3">
      <div className="flex gap-2">
        <label htmlFor="celebracoes-busca" className="sr-only">
          Buscar celebração pelo título
        </label>
        <input
          id="celebracoes-busca"
          name="q"
          type="search"
          defaultValue={values.q}
          maxLength={100}
          placeholder="Título da celebração"
          className={cn(inputClass, "flex-1 px-3")}
        />
        <button type="submit" className={cn(buttonVariants({ size: "lg" }), "h-10")}>
          <Search data-icon="inline-start" aria-hidden />
          Buscar
        </button>
      </div>
      <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <legend className="sr-only">Filtros</legend>
        <Field id="celebracoes-de" label="A partir de">
          <input id="celebracoes-de" name="de" type="date" defaultValue={values.de} className={inputClass} />
        </Field>
        <Field id="celebracoes-ate" label="Até">
          <input id="celebracoes-ate" name="ate" type="date" defaultValue={values.ate} className={inputClass} />
        </Field>
        <Field id="celebracoes-tempo" label="Tempo litúrgico">
          <select id="celebracoes-tempo" name="tempo" defaultValue={values.tempo} className={inputClass}>
            <option value="">Todos</option>
            {LITURGICAL_SEASONS.map((season) => (
              <option key={season.id} value={season.id}>
                {season.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="celebracoes-situacao" label="Situação editorial">
          <select id="celebracoes-situacao" name="situacao" defaultValue={values.situacao} className={inputClass}>
            <option value="">Todas</option>
            {REVIEW_STATUSES.map((status) => (
              <option key={status} value={status}>
                {REVIEW_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>
    </form>
  );
}

async function Results({ searchParams }: CelebrationsPageProps) {
  await connection();
  const { query, values } = readQuery(await searchParams);
  const page = await searchCelebrations(query).catch(() => null);

  return (
    <>
      <SearchForm values={values} />
      {!page ? (
        <div className="mt-6">
          <EmptyState
            icon={CloudOff}
            title="Calendário indisponível"
            description="Não foi possível consultar a base de celebrações agora. Tente novamente em instantes."
          />
        </div>
      ) : (
        <>
          <CelebrationList
            celebrations={page.celebrations}
            title={page.total === 1 ? "1 celebração" : `${page.total} celebrações`}
            description="Cada celebração mostra se já foi revisada. A base é editorial e não cobre o calendário inteiro."
          />
          {page.totalPages > 1 && (
            <nav aria-label="Páginas de celebrações" className="mt-4 flex items-center justify-between gap-2 text-sm">
              {page.page > 1 ? (
                <Link href={pageHref(values, page.page - 1)} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                  Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground tabular-nums">
                Página {page.page} de {page.totalPages}
              </span>
              {page.page < page.totalPages ? (
                <Link href={pageHref(values, page.page + 1)} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                  Próxima
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </>
  );
}

export default function CelebrationsPage({ searchParams }: CelebrationsPageProps) {
  return (
    <>
      <PageHeader
        title="Celebrações"
        description="Busque pelo título, por período, pelo tempo litúrgico ou pela situação da revisão."
      />
      <Suspense fallback={<ContentSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </>
  );
}
