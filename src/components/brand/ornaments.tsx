import { cn } from "cn";

/** Cruz latina simples, em traço, para separadores. Decorativa. */
export function LatinCross({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 24" aria-hidden className={cn("h-6 w-4", className)} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <path d="M8 1.5v21M2.5 7.5h11" />
    </svg>
  );
}

/** Linha dourada com a cruz ao centro, como nas referências visuais. */
export function CrossDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex items-center gap-3 text-gold", className)}>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/60 to-gold/80" />
      <LatinCross className="h-5 w-3.5" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/60 to-gold/80" />
    </div>
  );
}

/**
 * Janela em arco ogival, em traço fino e transparente, no canto do topo. Só ornamento: some
 * em telas estreitas e não carrega conteúdo.
 */
export function GothicWindow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 240"
      aria-hidden
      className={cn("pointer-events-none text-gold-strong", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
    >
      <defs>
        <radialGradient id="janela-luz" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="var(--card)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--card)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M20 240V110C20 55 62 12 110 2c48 10 90 53 90 108v130" fill="url(#janela-luz)" opacity="0.9" />
      <path d="M20 240V110C20 55 62 12 110 2c48 10 90 53 90 108v130" opacity="0.55" />
      <path d="M36 240V114C36 68 70 32 110 22c40 10 74 46 74 92v126" opacity="0.4" />
      <path d="M110 22v218M36 150h148M36 196h148" opacity="0.3" />
      <circle cx="110" cy="78" r="26" opacity="0.4" />
      <path d="M110 52v52M84 78h52" opacity="0.3" />
      <path d="M110 112v86M94 132h32" strokeWidth={3} opacity="0.35" strokeLinecap="round" />
    </svg>
  );
}
