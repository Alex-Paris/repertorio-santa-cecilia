import { cn } from "cn";
import {
  BookOpen,
  Church,
  Crown,
  DoorOpen,
  Flag,
  Flame,
  HandHeart,
  Heart,
  Leaf,
  ScrollText,
  Sparkles,
  Sprout,
  Star,
  Sun,
  Wine,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

import {
  LITURGICAL_SEASONS,
  momentLabel,
  seasonLabel,
  themeLabel,
  type BiblicalThemeId,
  type LiturgicalColor,
  type LiturgicalMomentId,
  type LiturgicalSeasonId,
} from "../domain/vocabulary";

/** Ícones dos momentos: só apoio visual, o nome vem sempre escrito. */
export const MOMENT_ICONS: Record<LiturgicalMomentId, LucideIcon> = {
  entrada: DoorOpen,
  "ato-penitencial": HandHeart,
  gloria: Sparkles,
  "salmo-responsorial": BookOpen,
  "aclamacao-ao-evangelho": ScrollText,
  "preparacao-das-oferendas": Wine,
  santo: Crown,
  "cordeiro-de-deus": Church,
  comunhao: Church,
  "acao-de-gracas": Heart,
  encerramento: Flag,
};

export const SEASON_ICONS: Record<LiturgicalSeasonId, LucideIcon> = {
  advento: Flame,
  natal: Star,
  quaresma: Leaf,
  "triduo-pascal": Church,
  pascoa: Sun,
  "tempo-comum": Sprout,
};

/**
 * Tinta suave da cor litúrgica, para etiquetas e atalhos. O branco não tinge: vira dourado
 * claro, para continuar visível. O texto mantém a cor normal, com contraste garantido.
 */
export function liturgicalTint(color: LiturgicalColor | null | undefined): CSSProperties {
  const base = color && color !== "branco" ? `var(--liturgy-${color})` : "var(--gold)";
  return { "--tag": base } as CSSProperties;
}

export const TINTED =
  "border-[color-mix(in_oklab,var(--tag)_35%,var(--border))] bg-[color-mix(in_oklab,var(--tag)_13%,var(--card))]";

const TAG = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.8rem] leading-5 whitespace-nowrap";

export function MomentTag({ moment, className }: { moment: LiturgicalMomentId; className?: string }) {
  const Icon = MOMENT_ICONS[moment];
  return (
    <span className={cn(TAG, "border-gold/40 bg-surface-alt", className)}>
      <Icon className="size-3.5 text-gold-strong" aria-hidden />
      {momentLabel(moment)}
    </span>
  );
}

export function SeasonTag({ season, className }: { season: LiturgicalSeasonId; className?: string }) {
  const Icon = SEASON_ICONS[season];
  const color = LITURGICAL_SEASONS.find((entry) => entry.id === season)?.color;
  return (
    <span style={liturgicalTint(color)} className={cn(TAG, TINTED, className)}>
      <Icon className="size-3.5 text-[color-mix(in_oklab,var(--tag)_80%,var(--foreground))]" aria-hidden />
      {seasonLabel(season)}
    </span>
  );
}

export function ThemeTag({ theme, className }: { theme: BiblicalThemeId; className?: string }) {
  return <span className={cn(TAG, "border-border bg-card text-muted-foreground", className)}>{themeLabel(theme)}</span>;
}
