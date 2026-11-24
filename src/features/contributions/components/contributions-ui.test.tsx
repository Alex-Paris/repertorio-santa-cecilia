import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogSongScreen } from "@/features/catalog/components/catalog-song-screen";
import { toCatalogSongView, type CatalogSong } from "@/features/catalog/domain/catalog-song";
import { VideoReference } from "@/features/songs/components/video-reference";

import type { AdminSubmission, MySubmission, SubmissionPreview } from "../domain/submission";
import { MySubmissionDetail, MySubmissions } from "./my-submissions";
import { SubmissionForm } from "./submission-form";
import { SubmissionReview } from "./submission-review";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), bfcacheId: "teste" }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/auth-client", () => import("@/test/fake-auth-client"));

const at = "2026-11-10T12:00:00.000Z";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

interface Call {
  url: string;
  method: string;
  ifMatch: string | null;
  userHeader: string | null;
  body?: Record<string, unknown>;
}
const calls: Call[] = [];

function stub(handler: (call: Call) => Response | Promise<Response>): void {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      const call = {
        url,
        method: init.method ?? "GET",
        ifMatch: headers.get("if-match"),
        userHeader: headers.get("x-repertorio-expected-user"),
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      return handler(call);
    }),
  );
}

const preview: SubmissionPreview = {
  snapshot: { title: "Canto Fictício", artist: "Autora Imaginária", originalKey: "D", contentType: "original", chordPro: "[D]Vinde todos" },
  sourceSongRevision: 2,
  duplicates: [],
  activeSubmission: null,
  limits: { maxPending: 5, pending: 1, maxPerDay: 10, today: 1, maxChordProLength: 50000 },
};

const mine: MySubmission = {
  id: "sub-1",
  personalSongId: "song-1",
  sourceSongRevision: 2,
  version: 1,
  snapshot: preview.snapshot,
  suggestedClassification: { moments: [], seasons: [], celebrations: [], themes: [] },
  video: null,
  rights: { status: "own-composition", license: { display: false, reproduce: false, redistribute: false }, declarationVersion: "v1", acceptedAt: at },
  credit: { show: false },
  status: "pending",
  history: [{ action: "submitted", actor: "author", at, version: 1 }],
  previousVersions: [],
  revision: 1,
  createdAt: at,
  submittedAt: at,
  reviewedAt: null,
  updatedAt: at,
};

beforeEach(() => {
  router.push.mockClear();
});

function chooseOwnComposition(): void {
  fireEvent.click(screen.getByLabelText("A composição é minha (letra e música)"));
}

describe("enviar sugestão", () => {
  it("mostra a prévia da versão enviada e lembra que a música continua particular", async () => {
    stub(() => json({ preview }));
    render(<SubmissionForm userId="user-a" songId="song-1" />);

    expect(await screen.findByText("Canto Fictício")).toBeDefined();
    expect(screen.getByText(/A sua música continua particular/)).toBeDefined();
    expect(screen.getByText("Ver a letra e a cifra enviadas")).toBeDefined();
    expect(calls[0]?.url).toBe("/api/v1/catalog/submissions/preview?songId=song-1");
    expect(calls[0]?.userHeader).toBe("user-a");
  });

  it("envia só referências e declarações, sem dono, conteúdo digitado nem crédito por padrão", async () => {
    stub((call) => (call.method === "POST" ? json({ submission: mine }, 201) : json({ preview })));
    render(<SubmissionForm userId="user-a" songId="song-1" />);
    await screen.findByText("Canto Fictício");

    chooseOwnComposition();
    fireEvent.click(screen.getByLabelText(/Declaro que as informações são verdadeiras/));
    fireEvent.click(screen.getByRole("button", { name: "Enviar sugestão" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/conta/sugestoes/sub-1"));
    const post = calls.find((call) => call.method === "POST")!;
    expect(post.url).toBe("/api/v1/catalog/submissions");
    expect(post.body).toMatchObject({
      songId: "song-1",
      credit: { show: false },
      video: null,
      rights: { status: "own-composition", accepted: true, license: { display: false, reproduce: false, redistribute: false } },
    });
    expect(post.body).not.toHaveProperty("ownerId");
    expect(post.body).not.toHaveProperty("chordPro");
    expect(String(post.body?.requestId)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sem a declaração aceita, não envia", async () => {
    stub(() => json({ preview }));
    render(<SubmissionForm userId="user-a" songId="song-1" />);
    await screen.findByText("Canto Fictício");
    chooseOwnComposition();
    fireEvent.click(screen.getByRole("button", { name: "Enviar sugestão" }));
    expect(await screen.findByText("Confirme a declaração antes de enviar.")).toBeDefined();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("repete o envio com o mesmo identificador depois de uma falha de rede", async () => {
    let attempts = 0;
    stub((call) => {
      if (call.method !== "POST") return json({ preview });
      attempts += 1;
      return attempts === 1 ? Promise.reject(new TypeError("rede")) : json({ submission: mine }, 200);
    });
    render(<SubmissionForm userId="user-a" songId="song-1" />);
    await screen.findByText("Canto Fictício");
    chooseOwnComposition();
    fireEvent.click(screen.getByLabelText(/Declaro que as informações são verdadeiras/));

    fireEvent.click(screen.getByRole("button", { name: "Enviar sugestão" }));
    expect(await screen.findByText(/a mesma sugestão não será duplicada/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Enviar sugestão" }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());

    const posts = calls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[0]!.body?.requestId).toBe(posts[1]!.body?.requestId);
  });

  it("autorização de letra e cifra só aparece para quem compôs ou tem autorização", async () => {
    stub(() => json({ preview }));
    render(<SubmissionForm userId="user-a" songId="song-1" />);
    await screen.findByText("Canto Fictício");

    fireEvent.click(screen.getByLabelText("A obra é de outra pessoa e não tenho autorização"));
    expect(screen.queryByLabelText(/Autorizo exibir e reproduzir/)).toBeNull();
    expect(screen.getByText(/pode publicar só título, autoria e tom/)).toBeDefined();

    chooseOwnComposition();
    const share = screen.getByLabelText(/Autorizo incluir a cifra em links públicos/) as HTMLInputElement;
    expect(share.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/Autorizo exibir e reproduzir/));
    expect(share.disabled).toBe(false);
  });

  it("músicas semelhantes: avisa, separa mesmo título de mesma música e exige uma escolha", async () => {
    stub(() =>
      json({
        preview: {
          ...preview,
          duplicates: [
            { id: "cat-1", title: "Canto Fictício", artist: "Autora Imaginária", status: "published", kind: "same-song" },
            { id: "cat-2", title: "Canto Fictício", artist: "Outra Pessoa", status: "published", kind: "same-title" },
          ],
        },
      }),
    );
    render(<SubmissionForm userId="user-a" songId="song-1" />);

    expect(await screen.findByText("Encontramos músicas semelhantes no catálogo.")).toBeDefined();
    expect(screen.getByText(/mesmo título, outra autoria/)).toBeDefined();
    expect(screen.getAllByRole("link", { name: /Ver no catálogo/ })[0]?.getAttribute("href")).toBe("/catalogo/cat-1");

    chooseOwnComposition();
    fireEvent.click(screen.getByLabelText(/Declaro que as informações são verdadeiras/));
    fireEvent.click(screen.getByRole("button", { name: "Enviar sugestão" }));
    expect(await screen.findByText(/Diga se a sua sugestão é outra música/)).toBeDefined();

    fireEvent.click(screen.getByLabelText("É outra música: vou explicar a diferença."));
    fireEvent.click(screen.getByRole("button", { name: "Enviar sugestão" }));
    expect(await screen.findByText(/Explique em poucas palavras/)).toBeDefined();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("valida o link do vídeo na hora e recusa código de incorporação", async () => {
    stub(() => json({ preview }));
    render(<SubmissionForm userId="user-a" songId="song-1" />);
    await screen.findByText("Canto Fictício");

    fireEvent.change(screen.getByLabelText(/Link do YouTube/), { target: { value: '<iframe src="x">' } });
    expect(screen.getByText(/Use um link do YouTube/)).toBeDefined();
    fireEvent.change(screen.getByLabelText(/Link do YouTube/), { target: { value: "https://youtu.be/abcdefghijk" } });
    expect(screen.queryByText(/Use um link do YouTube/)).toBeNull();
    expect(screen.getByLabelText("Este vídeo é uma apresentação minha.")).toBeDefined();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("sugestão em andamento para a mesma música: leva a ela, sem novo formulário", async () => {
    stub(() => json({ preview: { ...preview, activeSubmission: { id: "sub-1", status: "pending" } } }));
    render(<SubmissionForm userId="user-a" songId="song-1" />);
    expect((await screen.findByRole("link", { name: "Ver a sugestão" })).getAttribute("href")).toBe("/conta/sugestoes/sub-1");
    expect(screen.queryByRole("button", { name: "Enviar sugestão" })).toBeNull();
  });

  it("no limite de pendentes, explica e não deixa enviar", async () => {
    stub(() => json({ preview: { ...preview, limits: { ...preview.limits, pending: 5 } } }));
    render(<SubmissionForm userId="user-a" songId="song-1" />);
    expect(await screen.findByText(/já tem 5 sugestões em andamento/)).toBeDefined();
    expect((screen.getByRole("button", { name: "Enviar sugestão" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("minhas sugestões", () => {
  it("lista título, data, situação, justificativa e música resultante", async () => {
    stub(() =>
      json({
        submissions: [
          {
            id: "sub-2",
            personalSongId: "song-2",
            title: "Outro Canto",
            artist: "Autora",
            status: "needs_changes",
            version: 1,
            reviewNote: "Falta a segunda estrofe.",
            revision: 2,
            submittedAt: at,
            updatedAt: at,
          },
          {
            id: "sub-1",
            personalSongId: "song-1",
            title: "Canto Fictício",
            artist: "Autora",
            status: "approved",
            version: 1,
            resultingCatalogSong: { id: "cat-1", title: "Canto Fictício", published: true },
            revision: 2,
            submittedAt: at,
            updatedAt: at,
          },
        ],
      }),
    );
    render(<MySubmissions userId="user-a" />);
    expect(await screen.findByText("Precisa de correções")).toBeDefined();
    expect(screen.getByText("Falta a segunda estrofe.")).toBeDefined();
    expect(screen.getByText("Aprovada")).toBeDefined();
    expect(screen.getByText(/No catálogo/)).toBeDefined();
    expect(calls[0]?.url).toBe("/api/v1/catalog/submissions/mine");
  });

  it("retira com a revisão carregada", async () => {
    stub((call) => (call.method === "POST" ? json({ submission: { ...mine, status: "withdrawn", revision: 2 } }) : json({ submission: mine })));
    render(<MySubmissionDetail userId="user-a" submissionId="sub-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Retirar sugestão" }));
    fireEvent.click(await screen.findByRole("button", { name: "Retirar sugestão", hidden: false }));

    await waitFor(() => expect(calls.some((call) => call.method === "POST")).toBe(true));
    const post = calls.find((call) => call.method === "POST")!;
    expect(post.url).toBe("/api/v1/catalog/submissions/sub-1/withdraw");
    expect(post.ifMatch).toBe('"1"');
    expect(await screen.findByText("Retirada")).toBeDefined();
  });

  it("com correções pedidas, mostra a orientação e oferece editar e enviar nova versão", async () => {
    stub(() =>
      json({
        submission: {
          ...mine,
          status: "needs_changes",
          reviewNote: "Corrija o tom.",
          revision: 2,
          history: [...mine.history, { action: "request_changes", actor: "admin", at, version: 1, note: "Corrija o tom." }],
        },
      }),
    );
    render(<MySubmissionDetail userId="user-a" submissionId="sub-1" />);
    expect(await screen.findByText("A equipe pediu correções")).toBeDefined();
    expect(screen.getAllByText("Corrija o tom.").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Editar a música" }).getAttribute("href")).toBe("/musicas/song-1/editar");
    expect(screen.getByRole("button", { name: "Enviar nova versão" })).toBeDefined();
    // O colaborador não vê quem decidiu, só que foi a equipe.
    expect(screen.getByText(/equipe do catálogo/)).toBeDefined();
  });
});

const adminSubmission: AdminSubmission = {
  ...mine,
  rights: { ...mine.rights, license: { display: true, reproduce: true, redistribute: false } },
  credit: { show: true, name: "Grupo Santa Cecília" },
  submittedBy: { id: "user-a", name: "Ana", email: "ana@exemplo.org" },
  duplicates: [],
  resultingCatalogSongId: null,
  review: null,
};

describe("revisão da administração", () => {
  it("mostra remetente, direitos, cifra e as decisões", async () => {
    stub(() => json({ submission: adminSubmission }));
    render(<SubmissionReview userId="admin-1" submissionId="sub-1" />);
    expect(await screen.findByText(/Ana \(ana@exemplo.org\)/)).toBeDefined();
    expect(screen.getByText(/nunca aparece no catálogo/)).toBeDefined();
    expect(screen.getByText("Exibir no catálogo: autorizado")).toBeDefined();
    expect(screen.getByRole("button", { name: "Aprovar como música nova" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Recusar sugestão" })).toBeDefined();
  });

  it("quem enviou não decide sobre a própria sugestão", async () => {
    stub(() => json({ submission: { ...adminSubmission, submittedBy: { id: "admin-1", name: "Admin", email: "a@exemplo.org" } } }));
    render(<SubmissionReview userId="admin-1" submissionId="sub-1" />);
    expect(await screen.findByText(/outra pessoa da equipe precisa decidir/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Aprovar como música nova" })).toBeNull();
  });

  it("aprova com a revisão e um identificador de pedido; exige conferir duplicatas e direitos", async () => {
    stub((call) =>
      call.method === "POST"
        ? json({ error: { code: "precondition_failed", message: "Alterada." } }, 412)
        : json({ submission: adminSubmission }),
    );
    render(<SubmissionReview userId="admin-1" submissionId="sub-1" />);
    const approve = await screen.findByRole("button", { name: "Aprovar como música nova" });

    fireEvent.click(approve);
    expect(await screen.findByText("Confira as duplicatas e os direitos antes de aprovar.")).toBeDefined();

    fireEvent.click(screen.getByLabelText("Conferi as possíveis duplicatas"));
    fireEvent.click(screen.getByLabelText("Conferi a declaração de direitos"));
    fireEvent.click(screen.getByLabelText(/Publicar a letra e a cifra/));
    fireEvent.click(approve);

    await waitFor(() => expect(calls.some((call) => call.method === "POST")).toBe(true));
    const post = calls.find((call) => call.method === "POST")!;
    expect(post.url).toBe("/api/v1/admin/catalog/submissions/sub-1/approve");
    expect(post.ifMatch).toBe('"1"');
    expect(post.body).toMatchObject({ mode: "new", publishContent: true, shareContent: false, creditName: "Grupo Santa Cecília" });
    // Conflito: recarrega a sugestão e explica, sem afirmar falha definitiva.
    expect(await screen.findByText(/Esta sugestão mudou/)).toBeDefined();
  });

  it("sem autorização de exibição, só metadados", async () => {
    stub(() => json({ submission: { ...adminSubmission, rights: mine.rights } }));
    render(<SubmissionReview userId="admin-1" submissionId="sub-1" />);
    const publish = (await screen.findByLabelText(/Publicar a letra e a cifra/)) as HTMLInputElement;
    expect(publish.disabled).toBe(true);
    expect(screen.getByText(/só metadados/)).toBeDefined();
  });

  it("recusar exige justificativa", async () => {
    stub(() => json({ submission: adminSubmission }));
    render(<SubmissionReview userId="admin-1" submissionId="sub-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Recusar sugestão" }));
    expect(await screen.findByText("Registre a justificativa.")).toBeDefined();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });
});

describe("vídeo aprovado e crédito no catálogo", () => {
  const song: CatalogSong = {
    id: "cat-1",
    title: "Canto Fictício",
    artist: "Autora Imaginária",
    originalKey: "D",
    contentType: "original",
    chordPro: "[D]Vinde todos",
    status: "published",
    rights: {
      basis: "author-permission",
      evidence: "Contribuição.",
      displayChordPro: true,
      shareChordPro: false,
      linkExternalSource: false,
      approvedBy: "admin-1",
      approvedAt: at,
    },
    revision: 1,
    createdAt: at,
    updatedAt: at,
    publishedAt: at,
    liturgy: null,
    metadataSources: [],
    video: { provider: "youtube", videoId: "abcdefghijk", kind: "reference", approvedBy: "admin-1", approvedAt: at },
    contributions: [
      { submissionId: "sub-1", submissionVersion: 1, mode: "new", fields: [], approvedBy: "admin-1", approvedAt: at, publicCredit: "Grupo Santa Cecília" },
    ],
  };

  it("mostra “Enviado por” discreto e o vídeo sem carregar o player antes do clique", () => {
    render(<CatalogSongScreen song={toCatalogSongView(song)} />);
    expect(screen.getByText("Enviado por:").textContent).toContain("Grupo Santa Cecília");
    expect(document.querySelector("iframe")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Vídeo" }));
    const panel = screen.getByRole("complementary", { name: "Vídeo" });
    const external = within(panel).getByRole("link", { name: /Abrir no YouTube/ });
    expect(external.getAttribute("href")).toBe("https://www.youtube.com/watch?v=abcdefghijk");
    expect(external.getAttribute("rel")).toContain("noopener");

    const iframe = document.querySelector("iframe")!;
    expect(iframe.getAttribute("src")).toContain("https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0&autoplay=1");
  });

  it("sem crédito nem vídeo, não cria avisos extras", () => {
    render(<CatalogSongScreen song={toCatalogSongView({ ...song, video: undefined, contributions: undefined })} />);
    expect(screen.queryByText("Enviado por:")).toBeNull();
    expect(screen.queryByText("Sem vídeo de referência")).toBeNull();
  });

  it("identificador malformado não vira player", () => {
    render(<VideoReference title="Canto" videoId={'abc"><script>'} />);
    expect(screen.queryByRole("button", { name: "Vídeo" })).toBeNull();
  });
});
