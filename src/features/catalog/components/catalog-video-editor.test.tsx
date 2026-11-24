import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogSong } from "../domain/catalog-song";
import { CatalogVideoEditor } from "./catalog-video-editor";

const mocks = vi.hoisted(() => ({ updateVideo: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("../data/catalog-admin-api", () => ({ createCatalogAdminApi: () => ({ updateVideo: mocks.updateVideo }) }));

const video = { provider: "youtube", videoId: "abcdefghijk", kind: "reference", approvedBy: "admin-1", approvedAt: "2026-11-24T12:00:00.000Z" } as const;
const song: Pick<CatalogSong, "id" | "revision" | "video"> = { id: "cat-1", revision: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateVideo.mockResolvedValue({ ...song, revision: 4, video });
});

describe("vídeo direto no catálogo", () => {
  it("abre, valida e salva um link sem cifra nem tom obrigatório", async () => {
    render(<CatalogVideoEditor userId="admin-1" song={song} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar vídeo do YouTube" }));
    expect(document.activeElement).toBe(screen.getByLabelText("Link do YouTube"));
    fireEvent.change(screen.getByLabelText("Link do YouTube"), { target: { value: "https://youtu.be/abcdefghijk" } });
    fireEvent.change(screen.getByLabelText("Título do vídeo (opcional)"), { target: { value: " Ensaio " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar vídeo" }));
    await waitFor(() => expect(mocks.updateVideo).toHaveBeenCalledWith("cat-1", { url: "https://youtu.be/abcdefghijk", title: "Ensaio" }, 3));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(screen.queryByRole("form", { name: "Vídeo do YouTube" })).toBeNull();
    expect(screen.getByRole("button", { name: "Editar vídeo" })).toBeDefined();
  });

  it("recusa um link de outro site e conserva o formulário", () => {
    render(<CatalogVideoEditor userId="admin-1" song={song} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar vídeo do YouTube" }));
    fireEvent.change(screen.getByLabelText("Link do YouTube"), { target: { value: "https://example.com/video" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar vídeo" }));
    expect(screen.getByRole("alert").textContent).toContain("link HTTPS válido");
    expect(mocks.updateVideo).not.toHaveBeenCalled();
  });

  it("carrega o vídeo salvo e permite removê-lo sem apagar outros dados", async () => {
    mocks.updateVideo.mockResolvedValue({ ...song, revision: 4 });
    render(<CatalogVideoEditor userId="admin-1" song={{ ...song, video }} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar vídeo" }));
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Link do YouTube" }).value).toBe("https://www.youtube.com/watch?v=abcdefghijk");
    fireEvent.click(screen.getByRole("button", { name: "Remover vídeo" }));
    await waitFor(() => expect(mocks.updateVideo).toHaveBeenCalledWith("cat-1", null, 3));
    await waitFor(() => expect(screen.getByRole("button", { name: "Adicionar vídeo do YouTube" })).toBeDefined());
  });

  it("impede envio duplicado e mantém o link quando a gravação falha", async () => {
    let rejectSave!: (error: Error) => void;
    mocks.updateVideo.mockReturnValue(new Promise((_, reject) => { rejectSave = reject; }));
    render(<CatalogVideoEditor userId="admin-1" song={song} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar vídeo do YouTube" }));
    fireEvent.change(screen.getByLabelText("Link do YouTube"), { target: { value: "https://youtu.be/abcdefghijk" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar vídeo" }));
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Salvando…" }).disabled).toBe(true);
    rejectSave(new Error("Offline"));
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Link do YouTube" }).value).toBe("https://youtu.be/abcdefghijk");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
