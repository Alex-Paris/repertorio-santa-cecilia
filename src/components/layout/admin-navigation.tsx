"use client";

import { cn } from "cn";
import { BookOpen, CalendarDays, ClipboardCheck, Download, MessageSquareText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const sections = [
  { href: "/admin/catalogo", label: "Catálogo", description: "Músicas e publicações", icon: BookOpen },
  { href: "/admin/liturgia", label: "Liturgia", description: "Celebrações e leituras", icon: CalendarDays },
  { href: "/admin/contribuicoes", label: "Contribuições", description: "Sugestões da comunidade", icon: MessageSquareText },
  { href: "/admin/catalogo/importar", label: "Importar", description: "Adicionar metadados", icon: Download },
  { href: "/admin/catalogo/qualidade", label: "Qualidade", description: "Conferir o catálogo", icon: ClipboardCheck },
];

function Navigation({ pathname }: { pathname: string | null }) {
  const active = sections.filter((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <aside className="min-w-0 lg:sticky lg:top-24">
      <div className="mb-3 flex items-center gap-2.5 px-1 lg:mb-5">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="size-4" aria-hidden /></span>
        <div>
          <p className="font-display text-lg font-semibold text-heading">Administração</p>
          <p className="hidden text-xs text-muted-foreground lg:block">Cuidar do acervo</p>
        </div>
      </div>
      <nav aria-label="Navegação administrativa" className="min-w-0 overflow-x-auto rounded-xl border bg-card p-1.5 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0">
        <ul className="flex w-max gap-1 lg:w-full lg:flex-col lg:gap-1.5">
          {sections.map((item) => (
            <li key={item.href} className="min-w-0">
              <Link href={item.href} aria-current={active === item.href ? "page" : undefined} className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active === item.href ? "bg-secondary font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}>
                <item.icon className="size-[1.1rem] shrink-0" aria-hidden />
                <span><span className="block">{item.label}</span><span className="mt-0.5 hidden text-xs font-normal text-muted-foreground lg:block">{item.description}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="mt-5 hidden border-t px-1 pt-4 text-xs leading-relaxed text-muted-foreground">As alterações passam pelas regras de revisão e publicação do acervo.</p>
    </aside>
  );
}

function CurrentNavigation() {
  return <Navigation pathname={usePathname()} />;
}

export function AdminNavigation() {
  return <Suspense fallback={<Navigation pathname={null} />}><CurrentNavigation /></Suspense>;
}
