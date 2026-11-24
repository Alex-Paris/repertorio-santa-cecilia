"use client";

export interface VideoPreview {
  ownerId: string;
  videoId: string;
  startSeconds: number;
}

let current: VideoPreview | null = null;
const listeners = new Set<() => void>();

function update(next: VideoPreview | null) {
  current = next;
  for (const listener of listeners) listener();
}

/** Uma única reprodução por aba; nada é persistido nem carregado antes do clique. */
export const videoPreview = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getSnapshot: (): VideoPreview | null => current,
  getServerSnapshot: (): VideoPreview | null => null,
  open: (next: VideoPreview) => update(next),
  stop(ownerId: string) {
    if (current?.ownerId === ownerId) update(null);
  },
};
