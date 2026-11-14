import type { StorageLike } from "@/features/library/data/library-storage";

/** Armazenamento em memória que sobrevive à recriação do store, como o `localStorage`. */
export function createMemoryStorage(initial: Record<string, string> = {}): StorageLike & {
  data: Map<string, string>;
  setItem: (key: string, value: string) => void;
} {
  const data = new Map(Object.entries(initial));

  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}
