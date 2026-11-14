"use client";

import { cn } from "cn";
import { Moon, Sun } from "lucide-react";
import { useLayoutEffect } from "react";

import { Button } from "@/components/ui/button";
import { applyPreferredTheme, toggleTheme } from "@/lib/utils/theme";

export function ThemeToggle({ className }: { className?: string }) {
  useLayoutEffect(() => {
    applyPreferredTheme();
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      className={cn("size-10", className)}
      aria-label="Alternar entre tema claro e escuro"
      onClick={toggleTheme}
    >
      <Moon className="size-5 dark:hidden" aria-hidden />
      <Sun className="hidden size-5 dark:block" aria-hidden />
    </Button>
  );
}
