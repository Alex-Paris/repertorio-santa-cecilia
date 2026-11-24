import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LibraryError } from "@/features/library/domain/library-errors";
import { normalizeLiturgyPrefill } from "@/server/liturgy/liturgy-prefill";
import { upstreamLiturgy } from "@/test/liturgy-prefill-fixtures";

import type { LiturgyPrefill } from "../../domain/prefill";
import { CelebrationPrefill } from "./celebration-prefill";

const preview = () => normalizeLiturgyPrefill(upstreamLiturgy(), "2027-01-10", "2026-11-24");

function lookup(): void {
  fireEvent.change(screen.getByLabelText("Buscar liturgia por data"), { target: { value: "2027-01-10" } });
  fireEvent.submit(screen.getByRole("form", { name: "Consultar liturgia" }));
}

describe("preenchimento por consulta de data", () => {
  it("mostra o resultado antes de alterar o formulário e carrega outro ano sem nova inclusão no código", async () => {
    const onApply = vi.fn();
    const load = vi.fn().mockResolvedValue(preview());
    render(<CelebrationPrefill pending={false} dirty={false} loadByDate={load} onApply={onApply} />);
    lookup();
    expect(screen.getByRole("button", { name: "Buscando liturgia…" }).getAttribute("aria-busy")).toBe("true");
    const result = await screen.findByRole("region", { name: "Liturgia consultada" });
    expect(within(result).getByText("Batismo do Senhor")).toBeDefined();
    expect(within(result).getByText("Evangelho: Mc 1,7-11")).toBeDefined();
    expect(onApply).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledWith("2027-01-10", expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button", { name: "Usar dados consultados" }));
    expect(onApply).toHaveBeenCalledWith(preview().draft);
    expect(screen.getByRole("status").textContent).toContain("formulário preenchido");
  });

  it("pede confirmação antes de substituir alterações e permite mantê-las", async () => {
    const onApply = vi.fn();
    render(<CelebrationPrefill pending={false} dirty loadByDate={vi.fn().mockResolvedValue(preview())} onApply={onApply} />);
    lookup();
    fireEvent.click(await screen.findByRole("button", { name: "Usar dados consultados" }));
    expect(screen.getByRole("alert").textContent).toContain("Há alterações não salvas");
    fireEvent.click(screen.getByRole("button", { name: "Manter alterações" }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Usar dados consultados" }));
    fireEvent.click(screen.getByRole("button", { name: "Substituir preenchimento" }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("ignora consulta antiga quando a data muda durante a busca", async () => {
    let resolve!: (value: LiturgyPrefill) => void;
    const load = vi.fn().mockImplementation(() => new Promise<LiturgyPrefill>((done) => { resolve = done; }));
    const onApply = vi.fn();
    render(<CelebrationPrefill pending={false} dirty={false} loadByDate={load} onApply={onApply} />);
    lookup();
    fireEvent.change(screen.getByLabelText("Buscar liturgia por data"), { target: { value: "2027-01-11" } });
    await act(async () => resolve(preview()));
    expect(load.mock.calls[0][1].aborted).toBe(true);
    expect(screen.queryByRole("region", { name: "Liturgia consultada" })).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("permite tentar novamente depois de falha, sem aplicar dados ou revelar a resposta interna", async () => {
    const onApply = vi.fn();
    const load = vi.fn().mockRejectedValueOnce(new LibraryError("remote-unavailable", "segredo-interno")).mockResolvedValue(preview());
    render(<CelebrationPrefill pending={false} dirty={false} loadByDate={load} onApply={onApply} />);
    lookup();
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível consultar a liturgia");
    expect(screen.getByRole("alert").textContent).not.toContain("segredo");
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Buscar liturgia" }));
    await screen.findByRole("region", { name: "Liturgia consultada" });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("exige escolher grau quando a fonte não o informou", async () => {
    const result = preview();
    result.draft.rank = null;
    const onApply = vi.fn();
    render(<CelebrationPrefill pending={false} dirty={false} loadByDate={vi.fn().mockResolvedValue(result)} onApply={onApply} />);
    lookup();
    const apply = await screen.findByRole("button", { name: "Usar dados consultados" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("combobox", { name: "Grau da celebração" }), { target: { value: "festa" } });
    fireEvent.click(apply);
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ rank: "festa" })));
  });
});
