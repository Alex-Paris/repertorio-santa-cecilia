import { cn } from "cn";
import Image from "next/image";

import illustration from "@/assets/brand/santa-cecilia-ilustracao.webp";
import mark from "@/assets/brand/santa-cecilia-marca.webp";

/**
 * Identidade do Grupo de Canto Santa Cecília. Os dois arquivos são recortes do logotipo
 * original enviado pelo grupo (sem redesenho): a ilustração inteira, com o fundo em aquarela,
 * e um detalhe do rosto e da lira para a marca do cabeçalho. As proporções são preservadas.
 */
export const SANTA_CECILIA_CREDIT =
  "Ilustração de Santa Cecília: Grupo de Canto Santa Cecília, Paróquia Menino Jesus de Praga e São Francisco Xavier.";

export function SantaCeciliaMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-full bg-card ring-2 ring-header-accent/70",
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
      alt="Santa Cecília tocando lira, em aquarela"
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      className={cn("h-auto select-none", className)}
    />
  );
}
