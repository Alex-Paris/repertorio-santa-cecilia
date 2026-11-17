import { describe, expect, it } from "vitest";

import type { Song } from "@/features/songs/domain/song";

import {
  approvalRequestSchema,
  buildSubmissionSnapshot,
  canLicenseContent,
  comparableTitle,
  decisionNoteSchema,
  findDuplicateMatches,
  isFinalSubmissionStatus,
  nextSubmissionStatus,
  publicNameProblem,
  resubmissionRequestSchema,
  SUBMISSION_STATUSES,
  submissionRequestSchema,
  toSubmissionVideo,
  type SubmissionRequest,
} from "./submission";

const REQUEST_ID = "6f1c7a52-6c1e-4f43-9f5b-1d9c6f3c2a10";

const personal: Song = {
  id: "song-1",
  title: "Canto Fictício da Entrada",
  artist: "Compositora Imaginária",
  originalKey: "D",
  contentType: "original",
  chordPro: "{title: Canto}\n[D]Vinde todos",
  revision: 4,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-02T00:00:00.000Z",
};

function request(overrides: Partial<SubmissionRequest> = {}): SubmissionRequest {
  return {
    songId: "song-1",
    requestId: REQUEST_ID,
    rights: { status: "own-composition", accepted: true },
    credit: { show: false },
    ...overrides,
  };
}

describe("situações da sugestão", () => {
  it("segue só as transições válidas", () => {
    expect(nextSubmissionStatus("pending", "approve")).toBe("approved");
    expect(nextSubmissionStatus("pending", "reject")).toBe("rejected");
    expect(nextSubmissionStatus("pending", "request_changes")).toBe("needs_changes");
    expect(nextSubmissionStatus("pending", "withdraw")).toBe("withdrawn");
    expect(nextSubmissionStatus("needs_changes", "resubmit")).toBe("pending");
    expect(nextSubmissionStatus("needs_changes", "withdraw")).toBe("withdrawn");
    expect(nextSubmissionStatus("needs_changes", "reject")).toBe("rejected");
    // Correções pedidas não se aprovam sem nova versão; em análise não se "reenvia".
    expect(nextSubmissionStatus("needs_changes", "approve")).toBeNull();
    expect(nextSubmissionStatus("pending", "resubmit")).toBeNull();
  });

  it("aprovada, recusada e retirada são finais: nada volta à fila nem é publicado de novo", () => {
    for (const status of ["approved", "rejected", "withdrawn"] as const) {
      expect(isFinalSubmissionStatus(status)).toBe(true);
      for (const action of ["approve", "reject", "request_changes", "withdraw", "resubmit"] as const) {
        expect(nextSubmissionStatus(status, action)).toBeNull();
      }
    }
    expect(SUBMISSION_STATUSES.filter((status) => !isFinalSubmissionStatus(status))).toEqual(["pending", "needs_changes"]);
  });
});

describe("versão enviada", () => {
  it("copia só os campos editoriais da música particular", () => {
    const snapshot = buildSubmissionSnapshot(personal);
    expect(snapshot).toEqual({
      title: personal.title,
      artist: personal.artist,
      originalKey: "D",
      contentType: "original",
      chordPro: personal.chordPro,
    });
    expect(Object.keys(snapshot)).not.toContain("id");
    expect(Object.keys(snapshot)).not.toContain("ownerId");
    expect(Object.keys(snapshot)).not.toContain("revision");
  });

  it("é independente: editar a música particular depois não muda a cópia", () => {
    const song = { ...personal };
    const snapshot = buildSubmissionSnapshot(song);
    song.title = "Título editado depois";
    song.chordPro = "[A]Outra letra";
    expect(snapshot.title).toBe("Canto Fictício da Entrada");
    expect(snapshot.chordPro).toContain("Vinde todos");
  });

  it("link externo leva o endereço, nunca cifra", () => {
    const snapshot = buildSubmissionSnapshot({
      ...personal,
      contentType: "external-link",
      chordPro: undefined,
      sourceUrl: "https://exemplo.org/cifra",
    } as Song);
    expect(snapshot.sourceUrl).toBe("https://exemplo.org/cifra");
    expect(snapshot.chordPro).toBeUndefined();
  });
});

describe("pedido de envio", () => {
  it("aceita o mínimo e preenche os padrões: sem vídeo, sem classificação, sem licença", () => {
    const parsed = submissionRequestSchema.parse(request());
    expect(parsed.video).toBeNull();
    expect(parsed.suggestedClassification).toEqual({ moments: [], seasons: [], celebrations: [], themes: [] });
    expect(parsed.rights.license).toEqual({ display: false, reproduce: false, redistribute: false });
  });

  it("recusa campos fora do contrato, como dono, situação ou conteúdo digitado", () => {
    for (const extra of [{ ownerId: "outro" }, { submittedBy: "outro" }, { status: "approved" }, { chordPro: "[C]x" }]) {
      expect(submissionRequestSchema.safeParse({ ...request(), ...extra }).success).toBe(false);
    }
    // O reenvio não troca a música da sugestão.
    expect(resubmissionRequestSchema.safeParse(request()).success).toBe(false);
  });

  it("exige a declaração aceita", () => {
    const result = submissionRequestSchema.safeParse(request({ rights: { status: "own-composition", accepted: false as true } }));
    expect(result.success).toBe(false);
  });

  it("só quem compôs ou tem autorização concede licença; redistribuir exige exibir e reproduzir", () => {
    expect(canLicenseContent("own-composition")).toBe(true);
    expect(canLicenseContent("authorized")).toBe(true);
    for (const status of ["public-domain", "third-party", "unknown"] as const) {
      expect(canLicenseContent(status)).toBe(false);
      const result = submissionRequestSchema.safeParse(
        request({ rights: { status, accepted: true, license: { display: true, reproduce: true, redistribute: false } } }),
      );
      expect(result.success).toBe(false);
    }
    const onlyShare = submissionRequestSchema.safeParse(
      request({ rights: { status: "authorized", accepted: true, license: { display: false, reproduce: false, redistribute: true } } }),
    );
    expect(onlyShare.success).toBe(false);
    const displayWithoutReproduce = submissionRequestSchema.safeParse(
      request({ rights: { status: "authorized", accepted: true, license: { display: true, reproduce: false, redistribute: false } } }),
    );
    expect(displayWithoutReproduce.success).toBe(false);
    const full = submissionRequestSchema.safeParse(
      request({ rights: { status: "authorized", accepted: true, license: { display: true, reproduce: true, redistribute: true } } }),
    );
    expect(full.success).toBe(true);
  });

  it("aceita só textos dentro do limite", () => {
    expect(submissionRequestSchema.safeParse(request({ message: "x".repeat(1001) })).success).toBe(false);
    expect(submissionRequestSchema.safeParse(request({ message: "x".repeat(1000) })).success).toBe(true);
  });

  it("identificador de pedido precisa ser UUID", () => {
    expect(submissionRequestSchema.safeParse(request({ requestId: "123" })).success).toBe(false);
  });
});

describe("crédito público", () => {
  it("é opcional e, quando pedido, exige um nome próprio, nunca e-mail ou site", () => {
    expect(submissionRequestSchema.safeParse(request({ credit: { show: false } })).success).toBe(true);
    expect(submissionRequestSchema.safeParse(request({ credit: { show: true } })).success).toBe(false);
    expect(submissionRequestSchema.safeParse(request({ credit: { show: true, name: "Ministério São José" } })).success).toBe(true);
    for (const name of ["pessoa@exemplo.org", "https://exemplo.org", "www.exemplo", "meusite.com.br", "x", "y".repeat(61)]) {
      expect(publicNameProblem(name)).not.toBeNull();
    }
    expect(publicNameProblem("  Grupo   Santa Cecília ")).toBeNull();
  });
});

describe("vídeo", () => {
  it("guarda só provedor e identificador, a partir de links comuns, curtos e Shorts", () => {
    for (const url of ["https://www.youtube.com/watch?v=abcdefghijk", "https://youtu.be/abcdefghijk", "https://www.youtube.com/shorts/abcdefghijk"]) {
      const parsed = submissionRequestSchema.parse(request({ video: { url } }));
      expect(toSubmissionVideo(parsed.video)).toEqual({ provider: "youtube", videoId: "abcdefghijk", kind: "reference", ownPerformance: false });
    }
  });

  it("recusa outros sites, http e código de incorporação", () => {
    for (const url of [
      "http://www.youtube.com/watch?v=abcdefghijk",
      "https://vimeo.com/123",
      '<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe>',
      "javascript:alert(1)",
    ]) {
      expect(submissionRequestSchema.safeParse(request({ video: { url } })).success).toBe(false);
    }
  });

  it("“apresentação minha” é declaração e muda só o tipo", () => {
    const parsed = submissionRequestSchema.parse(request({ video: { url: "https://youtu.be/abcdefghijk", ownPerformance: true } }));
    expect(toSubmissionVideo(parsed.video)).toMatchObject({ kind: "performance", ownPerformance: true });
  });
});

describe("possíveis duplicatas", () => {
  const catalog = [
    { id: "a", title: "Canto Fictício da Entrada", artist: "Compositora Imaginária", status: "published" },
    { id: "b", title: "Canto fictício da entrada!", artist: "Outro Autor", status: "published" },
    { id: "c", title: "Canto fictício", artist: "Compositora Imaginária", status: "published" },
  ];

  it("normaliza caixa, acentos, pontuação e espaços", () => {
    expect(comparableTitle("  CANTO,  fictício da Entrada! ")).toBe(comparableTitle("Canto Ficticio da Entrada"));
  });

  it("mesmo título com a mesma autoria é a mesma música provável; com outra autoria, só o título", () => {
    const matches = findDuplicateMatches({ title: "canto ficticio da entrada", artist: "COMPOSITORA imaginária" }, catalog);
    expect(matches).toEqual([
      { ...catalog[0], kind: "same-song" },
      { ...catalog[1], kind: "same-title" },
    ]);
  });

  it("título diferente não é duplicata, mesmo com a mesma autoria", () => {
    expect(findDuplicateMatches({ title: "Outro canto", artist: "Compositora Imaginária" }, catalog)).toEqual([]);
  });

  it("sem autoria de um dos lados, o título igual conta como a mesma música provável", () => {
    expect(findDuplicateMatches({ title: "Canto fictício", artist: "" }, catalog)).toEqual([{ ...catalog[2], kind: "same-song" }]);
  });
});

describe("decisões da administração", () => {
  const base = {
    mode: "new" as const,
    requestId: REQUEST_ID,
    editorial: { title: "Canto", artist: "Autora" },
    publishContent: false,
    publish: true,
    includeClassification: false,
    includeVideo: false,
    creditName: null,
    duplicatesChecked: true as const,
    rightsChecked: true as const,
  };

  it("aprovar exige conferir duplicatas e direitos", () => {
    expect(approvalRequestSchema.safeParse(base).success).toBe(true);
    expect(approvalRequestSchema.safeParse({ ...base, duplicatesChecked: false }).success).toBe(false);
    expect(approvalRequestSchema.safeParse({ ...base, rightsChecked: false }).success).toBe(false);
  });

  it("complemento exige a música e a revisão de destino; não aceita trocar título nem cifra", () => {
    const complement = {
      mode: "complement" as const,
      requestId: REQUEST_ID,
      targetCatalogSongId: "cat-1",
      targetRevision: 3,
      includeClassification: true,
      includeVideo: false,
      duplicatesChecked: true as const,
    };
    expect(approvalRequestSchema.safeParse(complement).success).toBe(true);
    expect(approvalRequestSchema.safeParse({ ...complement, targetRevision: undefined }).success).toBe(false);
    expect(approvalRequestSchema.safeParse({ ...complement, editorial: base.editorial }).success).toBe(false);
    expect(approvalRequestSchema.safeParse({ ...complement, chordPro: "[C]" }).success).toBe(false);
  });

  it("recusar e pedir correções exigem justificativa", () => {
    expect(decisionNoteSchema.safeParse({ note: "  " }).success).toBe(false);
    expect(decisionNoteSchema.safeParse({ note: "Falta a segunda estrofe." }).success).toBe(true);
  });
});
