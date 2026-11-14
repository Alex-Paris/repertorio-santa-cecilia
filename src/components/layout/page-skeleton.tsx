export function PageSkeleton() {
  return (
    <div role="status" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">Carregando…</span>
      <div className="mb-3 h-4 w-24 rounded bg-muted" />
      <div className="h-8 w-2/3 rounded bg-muted" />
      <div className="mt-3 h-4 w-1/3 rounded bg-muted" />
      <div className="mt-8 h-64 rounded-xl bg-muted" />
    </div>
  );
}

/** Para telas cujo cabeçalho é estático e apenas o conteúdo depende dos dados salvos. */
export function ContentSkeleton() {
  return (
    <div role="status" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">Carregando…</span>
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  );
}
