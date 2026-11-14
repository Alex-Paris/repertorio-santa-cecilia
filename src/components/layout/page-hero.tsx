import { cn } from "cn";
import type { ReactNode } from "react";

import { CrossDivider, GothicWindow } from "@/components/brand/ornaments";
import { SantaCeciliaIllustration } from "@/components/brand/santa-cecilia";

interface PageHeroProps {
  title: string;
  subtitle?: ReactNode;
  /** `center`: início e missa; `start`: catálogo, com o título ao lado da ilustração. */
  align?: "center" | "start";
  /** Conteúdo sob o título (o cartão de escolha da missa, por exemplo). */
  children?: ReactNode;
  className?: string;
}

/**
 * Topo das páginas principais, como nas referências: Santa Cecília à esquerda, título em serifa
 * e subtítulo em itálico, com uma cruz dourada. A altura é contida para o conteúdo aparecer logo
 * abaixo, sem rolagem, no computador.
 */
export function PageHero({ title, subtitle, align = "center", children, className }: PageHeroProps) {
  const centered = align === "center";
  return (
    <section
      aria-labelledby="titulo-da-pagina"
      className={cn("relative isolate -mx-4 px-4 pt-4 pb-4 md:pt-5", !centered && !children && "md:min-h-[11.5rem] xl:min-h-[14.25rem]", className)}
    >
      {/* Luz quente atrás da ilustração e da janela; sem imagem de fundo. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(420px_300px_at_12%_38%,color-mix(in_oklab,var(--gold)_22%,transparent),transparent_70%),radial-gradient(360px_260px_at_92%_10%,color-mix(in_oklab,var(--card)_80%,transparent),transparent_70%)]"
      />
      <GothicWindow className="absolute top-0 right-3 -z-10 hidden h-[14rem] w-[12rem] opacity-45 xl:block" />

      <div className="flex items-center gap-3 md:items-start md:gap-0">
        <SantaCeciliaIllustration
          eager
          sizes="(min-width: 1280px) 300px, (min-width: 768px) 220px, 84px"
          className={cn(
            "w-[5.25rem] shrink-0 md:absolute md:top-3 md:left-1",
            centered ? "md:w-[12rem] xl:w-[15.25rem]" : "md:w-[10rem] xl:w-[12.75rem]",
          )}
        />
        <div
          className={cn(
            "min-w-0 flex-1",
            centered
              ? "md:pl-[13.5rem] md:text-center xl:pr-[9rem] xl:pl-[16rem]"
              : "md:pl-[11.5rem] xl:pl-[19rem] xl:pt-4",
          )}
        >
          <h1
            id="titulo-da-pagina"
            className={cn(
              "font-display font-semibold text-balance text-heading [font-variation-settings:'opsz'_72,'SOFT'_0,'WONK'_0]",
              centered ? "text-[1.75rem] leading-tight md:text-[2.6rem] xl:text-[3.45rem]" : "text-[1.9rem] leading-tight md:text-[2.8rem] xl:text-[3.75rem]",
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 font-display text-[0.95rem] text-pretty text-foreground/90 italic md:text-lg xl:text-[1.2rem]">
              {subtitle}
            </p>
          )}
          <CrossDivider className={cn("mt-2 hidden md:flex", centered ? "mx-auto max-w-sm" : "max-w-xl xl:ml-10")} />
        </div>
      </div>

      {children && (
        <div className={cn("relative mt-4", centered ? "md:pl-[12.5rem] xl:pl-[17.6rem]" : "md:pl-[12.5rem] xl:pl-[19rem]")}>
          {children}
        </div>
      )}
    </section>
  );
}
