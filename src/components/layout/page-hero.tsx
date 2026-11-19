import { cn } from "cn";
import type { ReactNode } from "react";

import { CrossDivider, GothicWindow } from "@/components/brand/ornaments";
import { SantaCeciliaIllustration } from "@/components/brand/santa-cecilia";

interface PageHeroProps {
  title: string;
  subtitle?: ReactNode;
  /**
   * `center`: início e missa. `start`: catálogo, compacto (Etapa 2E.4B), com a ilustração menor
   * ao lado do título para a lista de músicas aparecer logo.
   */
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
    // Container externo: o fundo vai de ponta a ponta da página (`data-bleed`), sem `100vw`.
    <section data-hero data-bleed aria-labelledby="titulo-da-pagina" className={cn("relative isolate overflow-x-clip", className)}>
      {/* Container interno: conteúdo, ilustração e janela na largura do site (1448px). */}
      <div className={cn("relative mx-auto w-full max-w-[1448px] px-4", centered ? "pt-4 pb-4 md:pt-5" : "pt-3 pb-3")}>
        {/*
          Luz quente atrás da ilustração (um núcleo mais dourado e um halo largo, Etapa 2F.2B) e da
          janela. A camada passa 24rem além do conteúdo dos dois
          lados, com as mesmas posições de antes (12% e 92% da largura do conteúdo): os degradês somem
          aos poucos em vez de serem cortados na borda do conteúdo. A seção corta só na horizontal
          (`overflow-x: clip`), na borda da tela, sem esconder menus que abram para baixo; uma máscara
          dissolve a luz até a base da seção, para não haver linha de corte embaixo.
        */}
        <div
          aria-hidden
          className="absolute inset-y-0 -right-[24rem] -left-[24rem] -z-10 [mask-image:linear-gradient(to_bottom,black_55%,transparent)] bg-[radial-gradient(300px_260px_at_calc(12%_+_18.24rem)_42%,color-mix(in_oklab,var(--gold)_30%,transparent),transparent_72%),radial-gradient(560px_380px_at_calc(12%_+_18.24rem)_40%,color-mix(in_oklab,var(--gold)_20%,transparent),transparent_70%),radial-gradient(360px_260px_at_calc(92%_-_20.16rem)_10%,color-mix(in_oklab,var(--card)_80%,transparent),transparent_70%)]"
        />
        <GothicWindow
          className={cn("absolute top-0 right-3 -z-10 hidden opacity-45 xl:block", centered ? "h-[14rem] w-[12rem]" : "h-[8.5rem] w-[7.5rem]")}
        />

        <div className={cn("flex items-center gap-3", centered ? "md:items-start md:gap-0" : "md:gap-5")}>
          <SantaCeciliaIllustration
            eager
            sizes={centered ? "(min-width: 1280px) 196px, (min-width: 768px) 156px, 68px" : "(min-width: 1280px) 108px, (min-width: 768px) 92px, 60px"}
            className={cn(
              "shrink-0",
              centered ? "w-[4.25rem] md:absolute md:top-3 md:left-4 md:w-[9.75rem] xl:left-6 xl:w-[12.25rem]" : "w-[3.75rem] md:w-[5.75rem] xl:w-[6.75rem]",
            )}
          />
          <div
            className={cn(
              "min-w-0 flex-1",
              centered
                ? "md:pl-[13.5rem] md:text-center xl:pr-[9rem] xl:pl-[16rem]"
                : "",
            )}
          >
            <h1
              id="titulo-da-pagina"
              className={cn(
                "font-display font-semibold text-balance text-heading [font-variation-settings:'opsz'_72,'SOFT'_0,'WONK'_0]",
                centered ? "text-[1.75rem] leading-tight md:text-[2.6rem] xl:text-[3.45rem]" : "text-[1.75rem] leading-tight md:text-[2.3rem] xl:text-[2.75rem]",
              )}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className={cn(
                  "mt-1 font-display text-[0.95rem] text-pretty text-foreground/90 italic",
                  centered ? "md:text-lg xl:text-[1.2rem]" : "md:text-base xl:text-[1.08rem]",
                )}
              >
                {subtitle}
              </p>
            )}
            <CrossDivider className={cn("mt-2 hidden md:flex", centered ? "mx-auto max-w-sm" : "max-w-md")} />
          </div>
        </div>

        {children && (
          <div className={cn("relative mt-4", centered && "md:pl-[12.5rem] xl:pl-[17.6rem]")}>
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
