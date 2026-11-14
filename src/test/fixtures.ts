import { withRevisions } from "@/test/fakes/memory-library-store";
import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import { demoSongs } from "@/features/songs/data/demo-songs";

/** Exemplos antigos como a conta os entregaria, já com revisão. */
export const versionedLibrary = withRevisions({ songs: demoSongs, repertoires: demoRepertoires });
export const versionedSongs = versionedLibrary.songs;
export const versionedRepertoires = versionedLibrary.repertoires;
