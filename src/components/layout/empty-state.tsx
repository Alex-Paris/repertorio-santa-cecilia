import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="surface-panel flex flex-col items-center border-dashed px-6 py-12 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/8"><Icon className="size-6 text-primary" aria-hidden /></span>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
