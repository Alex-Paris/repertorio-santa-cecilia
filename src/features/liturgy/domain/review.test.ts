import { describe, expect, it } from "vitest";

import { editorialRecord } from "@/test/liturgy-fixtures";

import { REVIEW_STATUSES } from "./calendar";
import {
  allowedReviewActions,
  checkReviewRequest,
  nextReviewStatus,
  reviewRequestSchema,
  statusAfterEdit,
} from "./review";

const approve = { action: "approve" as const, humanReviewConfirmed: true as const, sourceIds: ["cancao-nova"] };

describe("transições de revisão", () => {
  it("só a aprovação leva a revisada, e só a partir de revisão ou atualização", () => {
    for (const status of REVIEW_STATUSES) {
      const next = nextReviewStatus(status, "approve");
      expect(next).toBe(status === "pending_review" || status === "needs_update" ? "reviewed" : null);
    }
    for (const action of ["dispute", "resolve", "reopen"] as const) {
      for (const status of REVIEW_STATUSES) {
        expect(nextReviewStatus(status, action)).not.toBe("reviewed");
      }
    }
  });

  it("divergência precisa ser resolvida antes de nova aprovação", () => {
    expect(allowedReviewActions("disputed")).toEqual(["resolve"]);
    expect(nextReviewStatus("disputed", "resolve")).toBe("pending_review");
  });

  it("reabrir só vale para celebração revisada", () => {
    expect(nextReviewStatus("reviewed", "reopen")).toBe("needs_update");
    expect(nextReviewStatus("pending_review", "reopen")).toBeNull();
  });

  it("editar conteúdo nunca conserva a aprovação", () => {
    expect(statusAfterEdit("reviewed")).toBe("pending_review");
    expect(statusAfterEdit("needs_update")).toBe("pending_review");
    expect(statusAfterEdit("pending_review")).toBe("pending_review");
    // A divergência continua aberta até alguém resolvê-la.
    expect(statusAfterEdit("disputed")).toBe("disputed");
  });
});

describe("pedido de revisão", () => {
  it("a aprovação exige a confirmação de conferência humana e as fontes", () => {
    expect(reviewRequestSchema.safeParse(approve).success).toBe(true);
    expect(reviewRequestSchema.safeParse({ ...approve, humanReviewConfirmed: false }).success).toBe(false);
    expect(reviewRequestSchema.safeParse({ action: "approve", sourceIds: ["cancao-nova"] }).success).toBe(false);
    expect(reviewRequestSchema.safeParse({ ...approve, sourceIds: [] }).success).toBe(false);
  });

  it("divergência, resolução e reabertura exigem observação; divergência, os campos", () => {
    expect(reviewRequestSchema.safeParse({ action: "dispute", fields: ["psalm"], note: "Salmo diferente no Lecionário." }).success).toBe(true);
    expect(reviewRequestSchema.safeParse({ action: "dispute", fields: [], note: "x" }).success).toBe(false);
    expect(reviewRequestSchema.safeParse({ action: "dispute", fields: ["titulo"], note: "x" }).success).toBe(false);
    expect(reviewRequestSchema.safeParse({ action: "reopen", note: " " }).success).toBe(false);
    expect(reviewRequestSchema.safeParse({ action: "resolve" }).success).toBe(false);
    expect(reviewRequestSchema.safeParse({ action: "publish" }).success).toBe(false);
  });

  it("as fontes da aprovação precisam estar registradas na celebração", () => {
    const record = editorialRecord("2026-11-22");
    expect(checkReviewRequest(record, approve)).toEqual({ ok: true, status: "reviewed" });
    expect(checkReviewRequest(record, { ...approve, sourceIds: ["fonte-inexistente"] })).toMatchObject({ ok: false });
    expect(checkReviewRequest(record, { ...approve, sourceIds: ["usccb", "usccb"] })).toMatchObject({ ok: false });
  });

  it("recusa a ação fora do estado permitido", () => {
    const reviewed = editorialRecord("2026-11-22", { reviewStatus: "reviewed" });
    expect(checkReviewRequest(reviewed, approve)).toEqual({
      ok: false,
      message: "Esta ação não é possível no estado atual da celebração.",
    });
    expect(checkReviewRequest(editorialRecord("2026-11-22", { reviewStatus: "disputed" }), approve)).toMatchObject({ ok: false });
  });
});
