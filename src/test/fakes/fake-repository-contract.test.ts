import { describeRepositoryContract } from "@/test/repository-contract";

import { createFakeRepertoireRepository } from "./fake-repertoire-repository";
import { createFakeSongRepository } from "./fake-song-repository";
import { createMemoryLibraryStore } from "./memory-library-store";

// Garante que a API falsa dos testes de interface se comporta como o repositório MongoDB real.
describeRepositoryContract("API falsa dos testes", async () => {
  const store = createMemoryLibraryStore();
  return { songs: createFakeSongRepository(store), repertoires: createFakeRepertoireRepository(store) };
});
