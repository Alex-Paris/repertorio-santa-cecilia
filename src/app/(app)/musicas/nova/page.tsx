import type { Metadata } from "next";

import { SongFormScreen } from "@/features/songs/components/song-form-screen";

export const metadata: Metadata = { title: "Nova música" };

export default function NewSongPage() {
  return <SongFormScreen />;
}
