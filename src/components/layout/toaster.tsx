"use client";

import { cn } from "cn";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useSyncExternalStore } from "react";

import { toastStore } from "@/lib/utils/toast";

export function Toaster() {
  const toasts = useSyncExternalStore(
    toastStore.subscribe,
    toastStore.getSnapshot,
    toastStore.getServerSnapshot,
  );

  return (
    <div
      data-print-hide
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-60 flex flex-col gap-2 md:right-6 md:bottom-6 md:left-auto md:w-80"
    >
      {toasts.map((toast) => {
        const Icon = toast.tone === "success" ? CircleCheck : CircleAlert;
        return (
          <p
            key={toast.id}
            className="flex items-start gap-2 rounded-lg border bg-popover px-3 py-2.5 text-sm text-popover-foreground shadow-md"
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                toast.tone === "success" ? "text-chord" : "text-destructive",
              )}
              aria-hidden
            />
            {toast.message}
          </p>
        );
      })}
    </div>
  );
}
