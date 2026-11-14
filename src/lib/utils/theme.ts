const THEME_STORAGE_KEY = "repertorio-theme";

type Theme = "light" | "dark";

/**
 * Executado de forma síncrona no <head>, antes da primeira pintura, para evitar
 * o clarão do tema errado. Sem preferência salva, segue o sistema operacional.
 */
export const themeInitScript = `(function(){var t;try{t=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)})()`;

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function getSystemTheme(): Theme {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

/** Reaplica o tema preferido: o Strict Mode remove o atributo ao remontar em desenvolvimento. */
export function applyPreferredTheme(): void {
  applyTheme(readStoredTheme() ?? getSystemTheme());
}

export function toggleTheme(): void {
  const current = document.documentElement.getAttribute("data-theme");
  const next: Theme = current === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Sem armazenamento disponível, o tema vale apenas para a sessão atual.
  }
}
