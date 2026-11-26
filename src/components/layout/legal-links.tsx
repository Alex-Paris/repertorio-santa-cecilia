import Link from "next/link";

export function LegalLinks() {
  return (
    <nav aria-label="Privacidade e termos" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
      <Link href="/privacidade" className="inline-flex min-h-10 items-center rounded-sm underline underline-offset-4 hover:text-foreground">
        Privacidade
      </Link>
      <Link href="/termos-de-uso" className="inline-flex min-h-10 items-center rounded-sm underline underline-offset-4 hover:text-foreground">
        Termos de uso
      </Link>
      <Link href="/exclusao-de-dados" className="inline-flex min-h-10 items-center rounded-sm underline underline-offset-4 hover:text-foreground">
        Exclusão de dados
      </Link>
      <Link href="/creditos-das-imagens" className="inline-flex min-h-11 items-center rounded-sm underline underline-offset-4 hover:text-foreground">Créditos das imagens</Link>
    </nav>
  );
}
