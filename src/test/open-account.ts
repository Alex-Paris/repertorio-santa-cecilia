import { vi } from "vitest";

import { accountLibrary } from "@/features/library/data/browser-library";
import type { LibraryRecord } from "@/features/library/domain/library";
import { demoRepertoires } from "@/features/repertoires/data/demo-repertoires";
import { demoSongs } from "@/features/songs/data/demo-songs";

import { fakeAccount } from "./fake-account-api";

/** Fixtures dos testes; a aplicação não cria mais dados de exemplo em conta alguma. */
export const FIXTURE_LIBRARY: LibraryRecord = { songs: demoSongs, repertoires: demoRepertoires };

/**
 * Entra em uma conta falsa com a biblioteca já carregada. O arquivo de teste precisa declarar:
 * `vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));`
 */
export async function openAccount(library: LibraryRecord = FIXTURE_LIBRARY, userId = "user-a"): Promise<void> {
  fakeAccount.reset();
  fakeAccount.signIn(userId, library);
  vi.stubGlobal("fetch", fakeAccount.fetch);

  accountLibrary.prepareSignOut();
  await accountLibrary.checkSession();
  await vi.waitFor(() => {
    if (accountLibrary.getSnapshot().status !== "ready") {
      throw new Error("biblioteca ainda não carregou");
    }
  });
}

/** Termina em um estado sem sessão, com a API falsa respondendo 401. */
export async function openSignedOut(): Promise<void> {
  fakeAccount.reset();
  vi.stubGlobal("fetch", fakeAccount.fetch);
  accountLibrary.prepareSignOut();
}
