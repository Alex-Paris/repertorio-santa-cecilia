import type { RepertoireRepository } from "@/features/repertoires/data/repertoire-repository";
import type { SongRepository } from "@/features/songs/data/song-repository";

import { LibraryError } from "../domain/library-errors";
import type {
  RemoteErrorReason,
  RemoteLibrary,
  RemoteLibraryCallbacks,
  RemoteLibrarySnapshot,
} from "./remote/remote-library";

const FOCUS_REVALIDATE_INTERVAL_MS = 10_000;

export type AccountLibrarySnapshot = RemoteLibrarySnapshot | { status: "signed-out" };

export type SessionCheck =
  | { status: "authenticated"; userId: string; email?: string }
  | { status: "anonymous" }
  | { status: "unavailable" };

export interface DraftHold {
  userId: string;
  /** Somente em memória; serve para pedir a senha da mesma conta. */
  email: string | null;
}

export interface AccountLibrary {
  songs: SongRepository;
  repertoires: RepertoireRepository;
  subscribe(listener: () => void): () => void;
  getSnapshot(): AccountLibrarySnapshot;
  getServerSnapshot(): AccountLibrarySnapshot;
  /** Confere no servidor quem está autenticado e carrega a biblioteca dessa conta. */
  checkSession(): Promise<void>;
  /** Nova tentativa depois de um erro, ou atualização explícita. */
  retry(): Promise<void>;
  /** Descarta os dados da conta. Chamado antes do logout. */
  prepareSignOut(): void;
  /** Conta dona dos dados em memória, se houver. */
  getRemoteUserId(): string | null;
  /** Informa que uma tela tem texto não salvo. `token` identifica cada formulário. */
  trackDraft(token: object, dirty: boolean): void;
  /** Sessão perdida com rascunho aberto: o formulário fica em tela até voltar à mesma conta. */
  getDraftHold(): DraftHold | null;
}

interface AccountLibraryOptions {
  getSession: () => Promise<SessionCheck>;
  createRemote: (userId: string, callbacks: RemoteLibraryCallbacks) => RemoteLibrary;
  notify: (message: string) => void;
}

type Current =
  | { kind: "checking" }
  | { kind: "signed-out" }
  /** Não foi possível confirmar a identidade: não há o que mostrar com segurança. */
  | { kind: "unavailable" }
  | { kind: "remote"; remote: RemoteLibrary };

const LOADING_SNAPSHOT: AccountLibrarySnapshot = { status: "loading" };
const SIGNED_OUT_SNAPSHOT: AccountLibrarySnapshot = { status: "signed-out" };
const UNAVAILABLE_SNAPSHOT: AccountLibrarySnapshot = { status: "remote-error", reason: "unavailable" };

const SESSION_CHANGED_MESSAGE = "A conta deste navegador mudou.";
const DRAFT_DISCARDED_MESSAGE = "O texto não salvo da conta anterior foi descartado.";

export type { RemoteErrorReason };

/**
 * Biblioteca da conta autenticada. Existe uma instância remota por login; os repositórios
 * abaixo acompanham a instância atual, e nenhum dado sobrevive à troca de conta.
 */
export function createAccountLibrary(options: AccountLibraryOptions): AccountLibrary {
  const { getSession, createRemote, notify } = options;
  const listeners = new Set<() => void>();
  const dirtyDrafts = new Map<object, string>();

  let current: Current = { kind: "checking" };
  let initialized = false;
  /** Muda sempre que a conta é abandonada: respostas anteriores deixam de valer. */
  let sessionEpoch = 0;
  let latestCheck = 0;
  let lastFocusCheck = 0;
  /** Conta cuja sessão caiu e que ainda pode voltar para salvar um rascunho. */
  let interruptedUserId: string | null = null;
  let knownAccount: { userId: string; email: string | null } | null = null;
  let draftHold: DraftHold | null = null;
  let lastChangedUserId: string | null = null;

  function refreshDraftHold(): void {
    const userId = interruptedUserId;

    if (!userId || ![...dirtyDrafts.values()].includes(userId)) {
      draftHold = null;
      return;
    }

    const email = knownAccount?.userId === userId ? knownAccount.email : null;
    if (draftHold?.userId !== userId || draftHold.email !== email) {
      draftHold = { userId, email };
    }
  }

  function emit(): void {
    refreshDraftHold();
    listeners.forEach((listener) => listener());
  }

  function abandonRemote(): void {
    if (current.kind === "remote") {
      current.remote.dispose();
    }
    sessionEpoch += 1;
    interruptedUserId = null;
  }

  function isExpired(remote: RemoteLibrary): boolean {
    const snapshot = remote.getSnapshot();
    return snapshot.status === "remote-error" && snapshot.reason === "session-expired";
  }

  function isCurrent(remote: RemoteLibrary): boolean {
    return current.kind === "remote" && current.remote === remote;
  }

  function enterRemote(userId: string): void {
    if (current.kind === "remote") {
      current.remote.dispose();
    }

    const remote: RemoteLibrary = createRemote(userId, {
      onChange: () => {
        if (isCurrent(remote)) {
          if (remote.getSnapshot().status === "ready") {
            interruptedUserId = null;
            lastChangedUserId = null;
          }
          emit();
        }
      },
      onSessionExpired: () => {
        if (isCurrent(remote)) {
          interruptedUserId = userId;
          emit();
        }
      },
      onSessionChanged: () => {
        if (!isCurrent(remote)) {
          return;
        }

        const isRepeated = lastChangedUserId === userId;
        lastChangedUserId = userId;
        announceAccountChange(userId);
        abandonRemote();
        // Sessão e API discordam de novo sobre a mesma conta: para em vez de repetir sem fim.
        current = { kind: isRepeated ? "unavailable" : "checking" };
        emit();
        if (!isRepeated) {
          void checkSession();
        }
      },
    });

    current = { kind: "remote", remote };
    emit();
    void remote.load();
  }

  /** Um rascunho é da conta anterior e não pode ficar à vista da nova. */
  function announceAccountChange(previousUserId: string): void {
    const hadDraft = [...dirtyDrafts.values()].includes(previousUserId);
    notify(hadDraft ? `${SESSION_CHANGED_MESSAGE} ${DRAFT_DISCARDED_MESSAGE}` : SESSION_CHANGED_MESSAGE);
  }

  /** Retorna `null` se a conta foi abandonada enquanto a consulta estava em andamento. */
  async function fetchSession(): Promise<SessionCheck | null> {
    const epoch = sessionEpoch;
    const result = await getSession();

    if (epoch !== sessionEpoch) {
      return null;
    }
    if (result.status === "authenticated") {
      knownAccount = { userId: result.userId, email: result.email ?? null };
    }
    return result;
  }

  function applyAuthenticated(userId: string): void {
    if (current.kind !== "remote") {
      enterRemote(userId);
    } else if (current.remote.userId !== userId) {
      announceAccountChange(current.remote.userId);
      abandonRemote();
      enterRemote(userId);
    } else if (isExpired(current.remote)) {
      enterRemote(userId);
    } else {
      emit();
    }
  }

  function applyAnonymous(): void {
    if (current.kind === "remote") {
      // A sessão terminou com dados em tela: os dados são descartados e a pessoa é avisada.
      if (!isExpired(current.remote)) {
        current.remote.expire();
      }
      emit();
    } else {
      current = { kind: "signed-out" };
      emit();
    }
  }

  function applyUnavailable(): void {
    if (current.kind !== "remote") {
      current = { kind: "unavailable" };
    }
    emit();
  }

  async function checkSession(): Promise<void> {
    latestCheck += 1;
    const id = latestCheck;
    const result = await fetchSession();

    if (!result || id !== latestCheck) {
      return;
    }

    switch (result.status) {
      case "authenticated":
        applyAuthenticated(result.userId);
        break;
      case "anonymous":
        applyAnonymous();
        break;
      case "unavailable":
        applyUnavailable();
    }
  }

  function revalidate(): void {
    if (document.visibilityState !== "visible" || current.kind !== "remote") {
      return;
    }

    const now = Date.now();
    if (now - lastFocusCheck < FOCUS_REVALIDATE_INTERVAL_MS) {
      return;
    }
    lastFocusCheck = now;

    const { remote } = current;
    void checkSession().then(() => {
      if (isCurrent(remote) && !isExpired(remote)) {
        void remote.load({ background: true });
      }
    });
  }

  function target(): { songs: SongRepository; repertoires: RepertoireRepository } {
    switch (current.kind) {
      case "remote":
        return current.remote;
      case "signed-out":
        throw new LibraryError("session-expired");
      default:
        throw new LibraryError("remote-unavailable");
    }
  }

  return {
    subscribe(listener) {
      const isFirstListener = listeners.size === 0;
      listeners.add(listener);

      if (isFirstListener) {
        window.addEventListener("focus", revalidate);
        document.addEventListener("visibilitychange", revalidate);

        if (!initialized) {
          initialized = true;
          void checkSession();
        } else {
          revalidate();
        }
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          window.removeEventListener("focus", revalidate);
          document.removeEventListener("visibilitychange", revalidate);
        }
      };
    },

    getSnapshot() {
      switch (current.kind) {
        case "checking":
          return LOADING_SNAPSHOT;
        case "signed-out":
          return SIGNED_OUT_SNAPSHOT;
        case "unavailable":
          return UNAVAILABLE_SNAPSHOT;
        case "remote":
          return current.remote.getSnapshot();
      }
    },

    getServerSnapshot: () => LOADING_SNAPSHOT,

    checkSession,

    async retry() {
      if (current.kind === "remote") {
        const background = current.remote.getSnapshot().status === "ready";
        await current.remote.load({ background });
      } else if (current.kind === "unavailable") {
        current = { kind: "checking" };
        emit();
        await checkSession();
      }
    },

    prepareSignOut() {
      abandonRemote();
      initialized = true;
      knownAccount = null;
      current = { kind: "signed-out" };
      emit();
    },

    getRemoteUserId: () => (current.kind === "remote" ? current.remote.userId : null),

    trackDraft(token, dirty) {
      if (dirty && current.kind === "remote") {
        dirtyDrafts.set(token, current.remote.userId);
      } else {
        dirtyDrafts.delete(token);
      }
      emit();
    },

    getDraftHold: () => draftHold,

    songs: {
      list: () => target().songs.list(),
      findById: (id) => target().songs.findById(id),
      findByIds: (ids) => target().songs.findByIds(ids),
      create: (input) => target().songs.create(input),
      update: (id, input, revision) => target().songs.update(id, input, revision),
      delete: (id, revision) => target().songs.delete(id, revision),
    },

    repertoires: {
      list: () => target().repertoires.list(),
      findById: (id) => target().repertoires.findById(id),
      create: (input) => target().repertoires.create(input),
      update: (id, input, revision) => target().repertoires.update(id, input, revision),
      delete: (id, revision) => target().repertoires.delete(id, revision),
      addSong: (id, songId, revision, source, moment) =>
        target().repertoires.addSong(id, songId, revision, source, moment),
      removeItem: (id, itemId, revision) => target().repertoires.removeItem(id, itemId, revision),
      moveItem: (id, itemId, direction, revision) =>
        target().repertoires.moveItem(id, itemId, direction, revision),
      updateItem: (id, itemId, changes, revision) =>
        target().repertoires.updateItem(id, itemId, changes, revision),
    },
  };
}
