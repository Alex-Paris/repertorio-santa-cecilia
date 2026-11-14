import { beforeEach, describe, expect, it } from "vitest";

import type { HostedSongRecord, SongInput } from "@/features/songs/domain/song";
import { fakeAccount } from "@/test/fake-account-api";
import { versionedLibrary } from "@/test/fixtures";

import { createRemoteLibrary, type RemoteLibrary } from "./remote-library";

const SARAU = "rep-sarau-de-domingo";

let remote: RemoteLibrary;

async function settle(): Promise<void> {
  for (let index = 0; index < 8; index++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** Dados de entrada da música, sem os campos controlados pelo servidor. */
function inputOf(title?: string): SongInput {
  const { title: original, artist, originalKey, contentType, chordPro } = fakeAccount.library().songs[0] as HostedSongRecord;
  return { title: title ?? original, artist, originalKey, contentType, ...(chordPro ? { chordPro } : {}) };
}

function current() {
  return fakeAccount.library().repertoires.find((repertoire) => repertoire.id === SARAU)!;
}

beforeEach(async () => {
  fakeAccount.reset();
  fakeAccount.signIn("u", versionedLibrary);
  remote = createRemoteLibrary({
    userId: "u",
    fetchImpl: (input, init) => fakeAccount.fetch(input, init),
    onChange: () => undefined,
    onSessionExpired: () => undefined,
    onSessionChanged: () => undefined,
  });
  await remote.load();
});

describe("revisões na biblioteca da conta", () => {
  it("alterações seguidas de itens nesta aba não conflitam entre si", async () => {
    const [first, second] = current().items;

    await Promise.all([
      remote.repertoires.updateItem(SARAU, first.id, { transposeSemitones: 2 }, 1),
      remote.repertoires.updateItem(SARAU, second.id, { notes: "Junto" }, 1),
      remote.repertoires.moveItem(SARAU, second.id, "up", 1),
    ]);

    expect(current().revision).toBe(4);
    expect(current().items.find((item) => item.id === first.id)?.transposeSemitones).toBe(2);
    expect(current().items.find((item) => item.id === second.id)?.notes).toBe("Junto");
  });

  it("uma alteração de outro dispositivo continua gerando conflito", async () => {
    const [first, second] = current().items;
    const notesBefore = second.notes;
    await fakeAccount.otherDevice().repertoires.updateItem(SARAU, first.id, { transposeSemitones: 5 }, 1);

    await expect(
      remote.repertoires.updateItem(SARAU, second.id, { notes: "Antiga" }, 1),
    ).rejects.toMatchObject({ code: "revision-conflict" });

    expect(current().items.find((item) => item.id === second.id)?.notes).toBe(notesBefore);
  });

  it("um conflito não aparece como alteração concluída", async () => {
    const song = fakeAccount.library().songs[0];
    await fakeAccount.otherDevice().songs.update(song.id, inputOf("Do outro"), 1);

    await expect(
      remote.songs.update(song.id, inputOf("Desta aba"), 1),
    ).rejects.toMatchObject({ code: "revision-conflict" });
    await settle();

    const snapshot = remote.getSnapshot();
    const shown = snapshot.status === "ready" ? snapshot.library.songs.find((entry) => entry.id === song.id) : null;
    expect(shown).toMatchObject({ title: "Do outro", revision: 2 });
  });

  it("formulários inteiros não são encadeados: duas edições com a mesma base conflitam", async () => {
    const song = fakeAccount.library().songs[0];
    const input = inputOf();

    await remote.songs.update(song.id, input, 1);

    await expect(remote.songs.update(song.id, input, 1)).rejects.toMatchObject({ code: "revision-conflict" });
  });

  it("a resposta confirmada traz a nova revisão para a tela", async () => {
    const song = fakeAccount.library().songs[0];

    const updated = await remote.songs.update(song.id, inputOf("Nova"), 1);

    expect(updated.revision).toBe(2);
    const snapshot = remote.getSnapshot();
    expect(snapshot.status === "ready" && snapshot.library.songs.find((entry) => entry.id === song.id)?.revision).toBe(2);
  });
});
