import { CircleAlert } from "lucide-react";

/** Erro geral de uma operação, como uma gravação que não pôde ser concluída. */
export function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      tabIndex={-1}
      className="flex items-start gap-2.5 rounded-xl border border-destructive/35 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}
