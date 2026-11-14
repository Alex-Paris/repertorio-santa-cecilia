"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { searchCatalogSongs } from "@/features/catalog/data/catalog-api";
import type { CatalogSongSummary } from "@/features/catalog/domain/catalog-song";
import { hasSongInRepertoire } from "../services/repertoire-items";

import { FormError } from "@/components/layout/form-error";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { repertoireRepository } from "@/features/library/data/browser-library";
import { getLibraryErrorMessage } from "@/features/library/domain/library-errors";
import { sortSongsByTitle } from "@/features/songs/services/song-filters";
import type { Song, SongId } from "@/features/songs/domain/song";
import { showToast } from "@/lib/utils/toast";

import type { Repertoire } from "../domain/repertoire";

interface AddSongToRepertoireProps {
  repertoire: Repertoire;
  songs: readonly Song[];
}

function PersonalSongPicker({ repertoire, songs }: AddSongToRepertoireProps) {
  const [selectedSongId, setSelectedSongId] = useState<SongId | "">("");
  const [error, setError] = useState<string | null>(null);

  const includedSongIds = new Set(
    repertoire.items.filter((item) => item.source === "personal").map((item) => item.songId),
  );
  const availableSongs = sortSongsByTitle(songs.filter((song) => !includedSongIds.has(song.id)));

  if (availableSongs.length === 0) {
    return (
      <p className="mb-4 text-sm text-muted-foreground">
        {songs.length === 0 ? "Sua biblioteca ainda não tem músicas. " : "Todas as músicas da biblioteca já estão neste repertório. "}
        <Link href="/musicas/nova" className="underline underline-offset-3">
          Cadastrar nova música
        </Link>
      </p>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!selectedSongId) {
      setError("Escolha uma música para adicionar.");
      return;
    }

    try {
      await repertoireRepository.addSong(repertoire.id, selectedSongId, repertoire.revision, "personal");
      const title = songs.find((song) => song.id === selectedSongId)?.title;
      setSelectedSongId("");
      showToast(`“${title}” adicionada ao repertório.`);
    } catch (caught) {
      setError(getLibraryErrorMessage(caught));
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mb-4 space-y-2">
      <label htmlFor="add-song" className="block text-sm font-medium">
        Adicionar música particular
      </label>
      <div className="flex gap-2">
        <NativeSelect
          id="add-song"
          value={selectedSongId}
          onChange={(event) => {
            setSelectedSongId(event.target.value);
            setError(null);
          }}
          className="min-w-0 flex-1"
        >
          <NativeSelectOption value="">Selecione uma música</NativeSelectOption>
          {availableSongs.map((song) => (
            <NativeSelectOption key={song.id} value={song.id}>
              {song.title} — {song.artist}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" size="lg" className="h-10 px-3">
          <Plus data-icon="inline-start" aria-hidden />
          Adicionar
        </Button>
      </div>
      {error && <FormError message={error} />}
    </form>
  );
}

type Mode = "catalog" | "personal";

/** O catálogo é a origem principal; músicas particulares continuam disponíveis. */
export function AddSongToRepertoire({ repertoire, songs }: AddSongToRepertoireProps) {
  const [mode, setMode] = useState<Mode>("catalog");

  return (
    <section aria-label="Adicionar músicas" className="mb-4 space-y-3">
      <div role="radiogroup" aria-label="Origem da música" className="flex gap-1">
        {(
          [
            ["catalog", "Catálogo"],
            ["personal", "Minhas músicas"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            variant={mode === value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {mode === "catalog" ? (
        <CatalogSongPicker repertoire={repertoire} />
      ) : (
        <PersonalSongPicker repertoire={repertoire} songs={songs} />
      )}
    </section>
  );
}

function CatalogSongPicker({ repertoire }: { repertoire: AddSongToRepertoireProps["repertoire"] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogSongSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function handleSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSearching(true);
    try {
      setResults((await searchCatalogSongs({ q: query, pageSize: 8 })).songs);
    } catch {
      setError("Não foi possível consultar o catálogo agora. Tente novamente.");
    } finally {
      setSearching(false);
    }
  }

  async function add(song: CatalogSongSummary): Promise<void> {
    setError(null);
    try {
      await repertoireRepository.addSong(repertoire.id, song.id, repertoire.revision, "catalog");
      showToast(`“${song.title}” adicionada ao repertório.`);
    } catch (caught) {
      setError(getLibraryErrorMessage(caught));
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSearch} role="search" className="flex gap-2">
        <label htmlFor="catalog-add-search" className="sr-only">
          Buscar no catálogo
        </label>
        <input
          id="catalog-add-search"
          type="search"
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar no catálogo"
          className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm"
        />
        <Button type="submit" size="lg" className="h-10 px-3" disabled={searching}>
          <Search data-icon="inline-start" aria-hidden />
          Buscar
        </Button>
      </form>
      {error && <FormError message={error} />}
      {results && results.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma música encontrada no catálogo.</p>
      )}
      {results && results.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {results.map((song) => {
            const included = hasSongInRepertoire(repertoire.items, "catalog", song.id);
            return (
              <li key={song.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{song.title}</span>
                  <span className="block truncate text-muted-foreground">{song.artist}</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={included}
                  aria-label={included ? `${song.title} já está no repertório` : `Adicionar ${song.title}`}
                  onClick={() => void add(song)}
                >
                  {included ? "Incluída" : "Adicionar"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
