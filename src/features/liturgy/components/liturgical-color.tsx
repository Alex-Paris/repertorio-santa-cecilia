import { cn } from "cn";

import { LITURGICAL_COLOR_LABELS, type LiturgicalColor } from "../domain/vocabulary";

const SWATCHES: Record<LiturgicalColor, string> = {
  verde: "bg-liturgy-verde",
  roxo: "bg-liturgy-roxo",
  branco: "bg-liturgy-branco",
  vermelho: "bg-liturgy-vermelho",
  roseo: "bg-liturgy-roseo",
};

/** A cor litúrgica informa o tempo ou a celebração: vem sempre com o nome por extenso. */
export function LiturgicalColorMark({ color, className }: { color: LiturgicalColor; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden className={cn("size-3 shrink-0 rounded-full border border-foreground/25", SWATCHES[color])} />
      {LITURGICAL_COLOR_LABELS[color]}
    </span>
  );
}
