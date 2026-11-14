import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { accountLibrary } from "@/features/library/data/browser-library";
import type { CatalogSongView } from "@/features/library/domain/library";
import { PublicShareView } from "@/features/sharing/components/public-share-view";
import { PublicSongScreen } from "@/features/sharing/components/public-song-screen";
import type { PublicShareSnapshot } from "@/features/sharing/domain/public-share";
import { fakeAccount } from "@/test/fake-account-api";
import { openAccount } from "@/test/open-account";

import { RepertoireDetailScreen } from "./repertoire-detail-screen";
import { RepertoireFormScreen } from "./repertoire-form-screen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

const ENSAIO = "rep-ensaio-acustico";
const MASS = { date: "2026-11-22", celebrationId: "2026-11-22-cristo-rei", title: "Cristo Rei" };

const PASTOR: CatalogSongView = {
  id: "cat-pastor",
  title: "Pastor que Reina",
  artist: "Grupo Imaginário",
  originalKey: "A",
  contentType: "original",
  chordPro: "[A]Letra",
  chordProAvailable: true,
};

let massId = "";

function stored(id: string) {
  const repertoire = fakeAccount.library().repertoires.find((candidate) => candidate.id === id);
  if (!repertoire) {
    throw new Error("repertório ausente");
  }
  return repertoire;
}

async function reload(): Promise<void> {
  await accountLibrary.retry();
  await waitFor(() => expect(accountLibrary.getSnapshot().status).toBe("ready"));
}

beforeEach(async () => {
  router.push.mockClear();
  await openAccount();
  fakeAccount.setCatalog([PASTOR]);
  const repertoires = fakeAccount.otherDevice().repertoires;
  const created = await repertoires.create({ name: "Missa de Cristo Rei", description: "", mass: MASS });
  const withCatalog = await repertoires.addSong(created.id, PASTOR.id, created.revision, "catalog", "comunhao");
  await repertoires.addSong(created.id, "song-caminhos", withCatalog.revision, "personal", "entrada");
  massId = created.id;
  await reload();
});

describe("repertório de missa", () => {
  it("mostra a celebração, a data e o momento de cada música, na ordem da missa", async () => {
    render(<RepertoireDetailScreen repertoireId={massId} />);
    await screen.findByRole("heading", { level: 1, name: "Missa de Cristo Rei" });

    expect(screen.getByText("Cristo Rei")).toBeDefined();
    expect(screen.getByText("domingo, 22 de novembro de 2026")).toBeDefined();
    expect(screen.getByRole("link", { name: "Ver a celebração e as sugestões" }).getAttribute("href")).toBe(
      `/preparar-missa?data=2026-11-22&celebracao=2026-11-22-cristo-rei&repertorio=${massId}`,
    );
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("EntradaCaminhos"),
      expect.stringContaining("ComunhãoPastor que Reina"),
    ]);
  });

  it("alterar o tom preserva o momento litúrgico", async () => {
    render(<RepertoireDetailScreen repertoireId={massId} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ajustar tom e anotações de Pastor que Reina" }));
    fireEvent.click(screen.getByRole("button", { name: "Aumentar um semitom" }));

    await waitFor(() =>
      expect(stored(massId).items.find((item) => item.songId === PASTOR.id)).toMatchObject({
        transposeSemitones: 1,
        moment: "comunhao",
        source: "catalog",
      }),
    );
  });

  it("troca e remove o momento de um item, sem mudar a ordem", async () => {
    render(<RepertoireDetailScreen repertoireId={massId} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ajustar tom e anotações de Pastor que Reina" }));

    fireEvent.change(screen.getByLabelText("Momento da missa"), { target: { value: "acao-de-gracas" } });
    await waitFor(() => expect(stored(massId).items[1].moment).toBe("acao-de-gracas"));

    fireEvent.change(screen.getByLabelText("Momento da missa"), { target: { value: "" } });
    await waitFor(() => expect(stored(massId).items[1]).not.toHaveProperty("moment"));
    expect(stored(massId).items.map((item) => item.songId)).toEqual(["song-caminhos", PASTOR.id]);
  });
});

describe("repertórios antigos", () => {
  it("continuam válidos, sem missa e sem momentos", async () => {
    render(<RepertoireDetailScreen repertoireId={ENSAIO} />);
    await screen.findByRole("heading", { level: 1, name: "Ensaio Acústico" });

    expect(screen.queryByRole("link", { name: "Ver a celebração e as sugestões" })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /^Ajustar tom e anotações de/ })[0]);
    expect(screen.queryByLabelText("Momento da missa")).toBeNull();
    expect(stored(ENSAIO)).not.toHaveProperty("mass");
    expect(stored(ENSAIO).items.every((item) => !("moment" in item))).toBe(true);
  });

  it("editar o nome não transforma o repertório em repertório de missa", async () => {
    render(<RepertoireFormScreen repertoireId={ENSAIO} />);
    fireEvent.change(await screen.findByLabelText("Nome"), { target: { value: "Ensaio de Quinta" } });
    expect((screen.getByRole("checkbox", { name: "Este repertório é para uma missa" }) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Salvar repertório" }));

    await waitFor(() => expect(stored(ENSAIO).name).toBe("Ensaio de Quinta"));
    expect(stored(ENSAIO)).not.toHaveProperty("mass");
  });
});

describe("formulário do repertório", () => {
  it("vincula a uma missa só quando a pessoa pede, com data e celebração", async () => {
    render(<RepertoireFormScreen repertoireId={ENSAIO} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Este repertório é para uma missa" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar repertório" }));
    expect(await screen.findByText("Informe uma data válida para a celebração.")).toBeDefined();
    expect(stored(ENSAIO)).not.toHaveProperty("mass");

    fireEvent.change(screen.getByLabelText("Data da celebração"), { target: { value: "2026-12-06" } });
    fireEvent.change(screen.getByLabelText("Celebração"), { target: { value: "2º Domingo do Advento" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar repertório" }));

    await waitFor(() => expect(stored(ENSAIO).mass).toEqual({ date: "2026-12-06", title: "2º Domingo do Advento" }));
  });

  it("mantém a referência da celebração ao editar o nome e a retira ao desvincular", async () => {
    const view = render(<RepertoireFormScreen repertoireId={massId} />);
    fireEvent.change(await screen.findByLabelText("Nome"), { target: { value: "Missa das 10h" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar repertório" }));
    await waitFor(() => expect(stored(massId).name).toBe("Missa das 10h"));
    expect(stored(massId).mass).toEqual(MASS);
    view.unmount();

    render(<RepertoireFormScreen repertoireId={massId} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Este repertório é para uma missa" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar repertório" }));

    await waitFor(() => expect(stored(massId)).not.toHaveProperty("mass"));
    // Os momentos já escolhidos ficam nos itens: desvincular não apaga escolhas.
    expect(stored(massId).items.map((item) => item.moment)).toEqual(["entrada", "comunhao"]);
  });
});

describe("link público de um repertório de missa", () => {
  const TOKEN = `${"a".repeat(22)}.${"b".repeat(43)}`;
  const share: PublicShareSnapshot = {
    name: "Missa de Cristo Rei",
    description: "",
    mass: { title: "Cristo Rei", date: "2026-11-22" },
    items: [
      {
        id: "a".repeat(32),
        position: 1,
        title: "Portas Abertas",
        artist: "Coral",
        originalKey: "D",
        transposeSemitones: 0,
        content: { kind: "chordpro", chordPro: "[D]Letra" },
        moment: "entrada",
      },
      {
        id: "b".repeat(32),
        position: 2,
        title: "Pastor que Reina",
        artist: "Grupo",
        originalKey: "A",
        transposeSemitones: 2,
        content: { kind: "none" },
        moment: "comunhao",
      },
    ],
  };

  it("mostra a celebração, a data escolhida, o momento e o tom de cada música", () => {
    render(<PublicShareView token={TOKEN} share={share} />);

    expect(screen.getByText("Cristo Rei")).toBeDefined();
    expect(screen.getByText("domingo, 22 de novembro de 2026")).toBeDefined();
    const rows = screen.getAllByRole("listitem");
    expect(rows[0].textContent).toContain("Entrada");
    expect(rows[0].textContent).toContain("D");
    expect(rows[1].textContent).toContain("Comunhão");
    // Lá maior, dois semitons acima: Si.
    expect(within(rows[1]).getByText("B")).toBeDefined();
  });

  it("sem a data publicada, mostra só o nome da celebração", () => {
    render(<PublicShareView token={TOKEN} share={{ ...share, mass: { title: "Cristo Rei" } }} />);
    expect(screen.getByText("Cristo Rei")).toBeDefined();
    expect(screen.queryByText(/22 de novembro/)).toBeNull();
  });

  it("a página da música informa o momento da missa", () => {
    render(<PublicSongScreen token={TOKEN} share={share} itemId={"a".repeat(32)} />);
    expect(screen.getByText("Momento da missa: Entrada")).toBeDefined();
  });

  it("um link antigo, sem missa, continua como antes", () => {
    const { mass: _mass, ...legacy } = share;
    void _mass;
    render(
      <PublicShareView
        token={TOKEN}
        share={{ ...legacy, items: legacy.items.map(({ moment, ...item }) => (void moment, item)) }}
      />,
    );
    expect(screen.queryByText("Cristo Rei")).toBeNull();
    expect(screen.queryByText("Entrada")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
