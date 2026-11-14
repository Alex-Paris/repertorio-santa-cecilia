import { authClient } from "@/features/auth/auth-client";
import type { RepertoireRepository } from "@/features/repertoires/data/repertoire-repository";
import type { SongRepository } from "@/features/songs/data/song-repository";
import { showToast } from "@/lib/utils/toast";

import { createAccountLibrary, type AccountLibrary, type SessionCheck } from "./account-library";
import { createRemoteLibrary } from "./remote/remote-library";

async function getBrowserSession(): Promise<SessionCheck> {
  try {
    const { data, error } = await authClient.getSession();

    if (error) {
      return { status: error.status === 401 ? "anonymous" : "unavailable" };
    }
    return data?.user?.id
      ? { status: "authenticated", userId: data.user.id, email: data.user.email }
      : { status: "anonymous" };
  } catch {
    return { status: "unavailable" };
  }
}

/** A biblioteca é sempre a da conta autenticada. As telas falam com este objeto e os repositórios. */
export const accountLibrary: AccountLibrary = createAccountLibrary({
  getSession: getBrowserSession,
  createRemote: (userId, callbacks) => createRemoteLibrary({ userId, ...callbacks }),
  notify: (message) => showToast(message, "error"),
});

export const songRepository: SongRepository = accountLibrary.songs;

export const repertoireRepository: RepertoireRepository = accountLibrary.repertoires;
