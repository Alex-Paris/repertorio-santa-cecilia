import { cn } from "cn";
import Image from "next/image";

import illustration from "@/assets/brand/santa-cecilia-logo.webp";
import mark from "@/assets/brand/santa-cecilia-marca.webp";

/**
 * Identidade do Repertório Santa Cecília. A marca do cabeçalho é um recorte do logotipo (auréola,
 * rosto e lira, sem redesenho, com fundo transparente) sobre um círculo marfim fixo, para manter as
 * cores do desenho nos dois temas. O mesmo recorte gera `app/icon.png` e `app/apple-icon.png`. O
 * topo das páginas mostra o logotipo inteiro, só aparado nas bordas transparentes.
 */
export const SANTA_CECILIA_CREDIT =
  "Ilustração de Santa Cecília: Grupo de Canto Santa Cecília, Paróquia Menino Jesus de Praga e São Francisco Xavier.";

export function SantaCeciliaMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-full bg-[#fff9ef] ring-2 ring-header-accent/70",
        className,
      )}
    >
      <Image src={mark} alt="" sizes="48px" className="size-full object-cover" />
    </span>
  );
}

interface IllustrationProps {
  className?: string;
  /** Tamanho exibido, para o navegador escolher a variante certa. */
  sizes: string;
  /** No topo da página a imagem aparece logo: carregamento prioritário. */
  eager?: boolean;
}

export function SantaCeciliaIllustration({ className, sizes, eager = false }: IllustrationProps) {
  return (
    <Image
      src={illustration}
      alt="Santa Cecília, com auréola, tocando lira"
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      className={cn("h-auto select-none", className)}
    />
  );
}
