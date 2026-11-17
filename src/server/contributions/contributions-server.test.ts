import { describe, expect, it } from "vitest";

import {
  catalogSongViewSchema,
  toCatalogSongView,
  type CatalogSong,
} from "@/features/catalog/domain/catalog-song";
import { LibraryError } from "@/features/library/domain/library-errors";
import { toErrorResponse } from "@/server/http/api-error";
import type { CatalogSubmissionDocument } from "@/server/database/models/catalog-submission-model";

import { DEFAULT_CONTRIBUTION_LIMITS, parseContributionLimits } from "./contribution-config";
import { toAdminSubmission, toMySubmission, toSubmissionSummary } from "./submission-mappers";

const at = new Date("2026-11-10T12:00:00.000Z");

function submission(overrides: Partial<CatalogSubmissionDocument> = {}): CatalogSubmissionDocument {
  return {
    id: "sub-1",
    submittedBy: "user-a",
    requestId: "6f1c7a52-6c1e-4f43-9f5b-1d9c6f3c2a10",
    personalSongId: "song-1",
    sourceSongRevision: 2,
    version: 1,
    snapshot: { title: "Canto Fictício", artist: "Autora", originalKey: "D", contentType: "original", chordPro: "[D]Letra" },
    previousVersions: [],
    suggestedClassification: { moments: ["entrada"], seasons: [], celebrations: [], themes: [] },
    videoReference: { provider: "youtube", videoId: "abcdefghijk", kind: "reference", ownPerformance: false },
    rightsDeclaration: {
      status: "own-composition",
      license: { display: true, reproduce: true, redistribute: false },
      declarationVersion: "2026-11-contribuicao-v1",
      acceptedAt: at,
    },
    publicCreditPreference: { show: true, name: "Grupo Santa Cecília" },
    status: "pending",
    review: null,
    resultingCatalogSongId: null,
    history: [{ action: "submitted", by: "user-a", actor: "author", at, version: 1 }],
    revision: 1,
    createdAt: at,
    submittedAt: at,
    reviewedAt: null,
    updatedAt: at,
    ...overrides,
  };
}

describe("visão do colaborador", () => {
  it("não traz a conta, o pedido nem quem decidiu na administração", () => {
    const reviewed = submission({
      status: "needs_changes",
      review: { by: "admin-x", at, decision: "request_changes", note: "Falta a segunda estrofe." },
      history: [
        { action: "submitted", by: "user-a", actor: "author", at, version: 1 },
        { action: "request_changes", by: "admin-x", actor: "admin", at, version: 1, note: "Falta a segunda estrofe." },
      ],
    });
    const view = toMySubmission(reviewed, null);
    const text = JSON.stringify(view);
    expect(text).not.toContain("user-a");
    expect(text).not.toContain("admin-x");
    expect(text).not.toContain("requestId");
    expect(view.reviewNote).toBe("Falta a segunda estrofe.");
    expect(view.history[1]).toEqual({ action: "request_changes", actor: "admin", at: at.toISOString(), version: 1, note: "Falta a segunda estrofe." });
  });

  it("a justificativa some quando a sugestão volta à análise", () => {
    const resubmitted = submission({ status: "pending", review: { by: "admin-x", at, decision: "request_changes", note: "Antiga" } });
    expect(toMySubmission(resubmitted, null).reviewNote).toBeUndefined();
    expect(toSubmissionSummary(resubmitted, null).reviewNote).toBeUndefined();
  });

  it("o resumo da lista não carrega a cifra", () => {
    const summary = toSubmissionSummary(submission(), { id: "cat-9", title: "Canto Fictício", published: true });
    expect(JSON.stringify(summary)).not.toContain("[D]Letra");
    expect(summary.resultingCatalogSong).toEqual({ id: "cat-9", title: "Canto Fictício", published: true });
  });
});

describe("visão da administração", () => {
  it("mostra remetente e duplicatas; o e-mail vem da consulta, não da sugestão", () => {
    const view = toAdminSubmission(submission(), { id: "user-a", name: "Ana", email: "ana@exemplo.org" }, []);
    expect(view.submittedBy).toEqual({ id: "user-a", name: "Ana", email: "ana@exemplo.org" });
    expect("resultingCatalogSong" in view).toBe(false);
    expect(Object.keys(submission())).not.toContain("email");
  });
});

describe("limites configuráveis", () => {
  it("usa os padrões sem variáveis e com texto vazio", () => {
    expect(parseContributionLimits({})).toEqual(DEFAULT_CONTRIBUTION_LIMITS);
    expect(parseContributionLimits({ CONTRIBUTION_MAX_PENDING: "" })).toEqual(DEFAULT_CONTRIBUTION_LIMITS);
    expect(DEFAULT_CONTRIBUTION_LIMITS.maxPending).toBe(5);
  });

  it("aceita valores válidos e volta ao padrão com valores inválidos", () => {
    expect(parseContributionLimits({ CONTRIBUTION_MAX_PENDING: "2", CONTRIBUTION_MAX_PER_DAY: "3", CONTRIBUTION_MAX_CHORDPRO_LENGTH: "1000" })).toEqual({
      maxPending: 2,
      maxPerDay: 3,
      maxChordProLength: 1000,
    });
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      expect(parseContributionLimits({ CONTRIBUTION_MAX_PENDING: "-1" })).toEqual(DEFAULT_CONTRIBUTION_LIMITS);
      expect(parseContributionLimits({ CONTRIBUTION_MAX_CHORDPRO_LENGTH: "999999999" })).toEqual(DEFAULT_CONTRIBUTION_LIMITS);
    } finally {
      console.error = original;
    }
    expect(errors).toHaveLength(2);
  });
});

describe("respostas de erro", () => {
  it("mapeia os erros das sugestões para os códigos HTTP", async () => {
    const cases: [ConstructorParameters<typeof LibraryError>[0], number][] = [
      ["submission-not-found", 404],
      ["submission-active", 409],
      ["submission-limit-exceeded", 429],
      ["submission-daily-limit", 429],
      ["submission-already-reviewed", 409],
      ["submission-duplicates", 409],
      ["submission-content-too-large", 413],
    ];
    for (const [code, status] of cases) {
      const response = toErrorResponse(new LibraryError(code));
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect((await response.json()).error.reason).toBe(code);
    }
  });
});

describe("música do catálogo vinda de contribuição", () => {
  const song: CatalogSong = {
    id: "cat-1",
    title: "Canto Fictício",
    artist: "Autora",
    originalKey: "D",
    contentType: "original",
    chordPro: "[D]Letra",
    status: "published",
    rights: {
      basis: "author-permission",
      evidence: "Contribuição sub-1.",
      displayChordPro: true,
      shareChordPro: false,
      linkExternalSource: false,
      approvedBy: "admin-x",
      approvedAt: at.toISOString(),
    },
    revision: 1,
    createdAt: at.toISOString(),
    updatedAt: at.toISOString(),
    publishedAt: at.toISOString(),
    liturgy: null,
    metadataSources: [],
    video: {
      provider: "youtube",
      videoId: "abcdefghijk",
      title: "Ensaio",
      kind: "performance",
      submissionId: "sub-1",
      approvedBy: "admin-x",
      approvedAt: at.toISOString(),
    },
    contributions: [
      {
        submissionId: "sub-1",
        submissionVersion: 1,
        mode: "new",
        fields: ["title", "chordPro", "video", "credit"],
        approvedBy: "admin-x",
        approvedAt: at.toISOString(),
        publicCredit: "Grupo Santa Cecília",
        license: { display: true, reproduce: true, redistribute: false, declarationVersion: "v1", acceptedAt: at.toISOString() },
      },
    ],
  };

  it("a projeção pública traz o vídeo estruturado e o crédito autorizado, e nada da administração", () => {
    const view = toCatalogSongView(song);
    expect(view.video).toEqual({ provider: "youtube", videoId: "abcdefghijk", title: "Ensaio" });
    expect(view.contributorCredit).toBe("Grupo Santa Cecília");
    const text = JSON.stringify(view);
    for (const hidden of ["admin-x", "sub-1", "approvedBy", "license", "contributions", "evidence"]) {
      expect(text).not.toContain(hidden);
    }
    expect(catalogSongViewSchema.safeParse(view).success).toBe(true);
  });

  it("sem crédito autorizado, nada de “Enviado por”; complemento não dá crédito", () => {
    const noCredit = toCatalogSongView({
      ...song,
      contributions: [
        { ...song.contributions![0]!, publicCredit: undefined },
        { submissionId: "sub-2", submissionVersion: 1, mode: "complement", fields: ["video"], approvedBy: "admin-x", approvedAt: at.toISOString(), publicCredit: "Outro" },
      ],
    });
    expect(noCredit.contributorCredit).toBeUndefined();
  });

  it("o esquema público recusa vídeo com endereço livre ou HTML", () => {
    const view = toCatalogSongView(song);
    expect(catalogSongViewSchema.safeParse({ ...view, video: { provider: "youtube", videoId: "<iframe>" } }).success).toBe(false);
    expect(catalogSongViewSchema.safeParse({ ...view, video: { ...view.video, url: "https://evil.example" } }).success).toBe(false);
  });
});
