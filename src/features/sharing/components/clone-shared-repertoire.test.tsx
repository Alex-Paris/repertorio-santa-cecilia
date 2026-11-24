import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CloneSharedRepertoire } from "./clone-shared-repertoire";

const mocks = vi.hoisted(() => ({ session: vi.fn(), request: vi.fn(), push: vi.fn() }));
vi.mock("@/features/auth/auth-client", () => ({ authClient: { getSession: mocks.session } }));
vi.mock("@/features/library/data/remote/library-api", () => ({ createLibraryApi: () => ({ request: mocks.request }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
const token = `${"a".repeat(22)}.${"b".repeat(43)}`;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ data: { user: { id: "user-b" } }, error: null });
  mocks.request.mockResolvedValue({ repertoire: { id: "minha-copia" }, skippedItems: 0 });
});

describe("copiar repertório compartilhado", () => {
  it("ler não consulta sessão ou biblioteca, e a ação leva o visitante ao login com retorno", async () => {
    mocks.session.mockResolvedValue({ data: null, error: null });
    render(<CloneSharedRepertoire token={token} />);
    expect(mocks.session).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Copiar para meus repertórios" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/entrar?retorno=${encodeURIComponent(`/s/${token}`)}`));
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("salva uma cópia e oferece acesso ao novo repertório", async () => {
    render(<CloneSharedRepertoire token={token} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar para meus repertórios" }));
    const link = await screen.findByRole("link", { name: "Abrir meu repertório" });
    expect(link.getAttribute("href")).toBe("/repertorios/minha-copia");
    expect(screen.getByRole("status").textContent).toContain("Cópia salva");
    expect(mocks.request).toHaveBeenCalledWith("/shares/clone", expect.anything(), { method: "POST", body: { token, requestId: expect.any(String) } });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("explica quando músicas indisponíveis não foram copiadas", async () => {
    mocks.request.mockResolvedValue({ repertoire: { id: "copia" }, skippedItems: 2 });
    render(<CloneSharedRepertoire token={token} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar para meus repertórios" }));
    expect((await screen.findByRole("status")).textContent).toContain("2 músicas indisponíveis");
  });

  it("uma nova tentativa após erro conserva o identificador para não duplicar", async () => {
    mocks.request.mockRejectedValueOnce(new Error("rede"));
    render(<CloneSharedRepertoire token={token} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar para meus repertórios" }));
    expect(await screen.findByRole("alert")).toBeDefined();
    const first = mocks.request.mock.calls[0][2].body.requestId;
    fireEvent.click(screen.getByRole("button", { name: "Copiar para meus repertórios" }));
    await screen.findByRole("status");
    expect(mocks.request.mock.calls[1][2].body.requestId).toBe(first);
  });
});
