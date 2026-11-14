export type ToastTone = "success" | "error";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const TOAST_DURATION_MS = 4500;
// No celular, muitos avisos empilhados cobririam o conteúdo.
const MAX_VISIBLE_TOASTS = 2;
const NO_TOASTS: readonly Toast[] = [];

let toasts = NO_TOASTS;
let nextId = 1;
const listeners = new Set<() => void>();

function setToasts(next: readonly Toast[]): void {
  toasts = next;
  listeners.forEach((listener) => listener());
}

export function dismissToast(id: number): void {
  setToasts(toasts.filter((toast) => toast.id !== id));
}

export function showToast(message: string, tone: ToastTone = "success"): void {
  const id = nextId++;
  setToasts([...toasts, { id, message, tone }].slice(-MAX_VISIBLE_TOASTS));
  setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
}

export const toastStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => toasts,
  getServerSnapshot: () => NO_TOASTS,
};
