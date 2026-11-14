"use client";

import { Search, SearchX } from "lucide-react";
import { useId, useState } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { CONTENT_TYPE_LABELS, CONTENT_TYPES, formatSongCount, type Song } from "../domain/song";
import { filterSongs, type ContentTypeFilter } from "../services/song-filters";
import { SongListItem } from "./song-list-item";

const FILTER_OPTIONS: { value: ContentTypeFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  ...CONTENT_TYPES.map((value) => ({ value, label: CONTENT_TYPE_LABELS[value] })),
];

export function SongLibrary({ songs }: { songs: Song[] }) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [contentType, setContentType] = useState<ContentTypeFilter>("all");

  const visibleSongs = filterSongs(songs, { query, contentType });

  function clearFilters(): void {
    setQuery("");
    setContentType("all");
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={searchId} className="sr-only">
          Buscar por título ou artista
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título ou artista"
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div role="group" aria-label="Filtrar por tipo de conteúdo" className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => {
          const pressed = contentType === option.value;
          return (
            <Button
              key={option.value}
              variant={pressed ? "default" : "outline"}
              size="lg"
              aria-pressed={pressed}
              onClick={() => setContentType(option.value)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {formatSongCount(visibleSongs.length)}
      </p>

      {visibleSongs.length > 0 ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {visibleSongs.map((song) => (
            <SongListItem key={song.id} song={song} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={SearchX}
          title="Nenhuma música encontrada"
          description="Tente buscar por outro título ou artista, ou escolha outro tipo de conteúdo."
          action={
            <Button variant="outline" size="lg" onClick={clearFilters}>
              Limpar busca e filtros
            </Button>
          }
        />
      )}
    </div>
  );
}
