import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { parseYouTubeId, youTubeEmbedUrl } from "../domain/video-reference";
import { VideoReference } from "./video-reference";

describe("endereço de vídeo", () => {
  it("aceita os formatos comuns do YouTube, só em https", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=abcdefghijk",
      "https://youtu.be/abcdefghijk",
      "https://m.youtube.com/watch?v=abcdefghijk&t=10",
      "https://www.youtube.com/embed/abcdefghijk",
      "https://www.youtube.com/shorts/abcdefghijk",
    ]) {
      expect(parseYouTubeId(url)).toBe("abcdefghijk");
    }
  });

  it("recusa outros sites, http, identificadores malformados e texto qualquer", () => {
    for (const url of [
      undefined,
      "",
      "http://www.youtube.com/watch?v=abcdefghijk",
      "https://evil.example/watch?v=abcdefghijk",
      "https://www.youtube.com/watch?v=curto",
      "https://www.youtube.com/watch?v=abcdefghijk%22onload",
      "javascript:alert(1)",
      "não é endereço",
    ]) {
      expect(parseYouTubeId(url)).toBeNull();
    }
  });

  it("incorpora no modo de privacidade aprimorada, sem reprodução automática", () => {
    expect(youTubeEmbedUrl("abcdefghijk")).toBe("https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0");
    expect(youTubeEmbedUrl("abcdefghijk")).not.toContain("autoplay");
  });
});

describe("referência em vídeo", () => {
  it("com link válido, abre um painel ao lado; o player só é carregado depois do pedido", () => {
    render(<VideoReference title="Canto Fictício" url="https://youtu.be/abcdefghijk" />);
    const toggle = screen.getByRole("button", { name: "Referência em vídeo" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector("iframe")).toBeNull();

    fireEvent.click(toggle);
    const panel = screen.getByRole("complementary", { name: "Referência em vídeo" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fechar referência em vídeo" }));
    expect(document.querySelector("iframe")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Carregar vídeo de Canto Fictício" }));
    const frame = screen.getByTitle("Referência em vídeo: Canto Fictício");
    expect(panel.contains(frame)).toBe(true);
    expect(frame.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0");
    expect(frame.getAttribute("allow")).not.toContain("autoplay");
  });

  it("o painel fecha com Esc e devolve o foco ao botão", () => {
    render(<VideoReference title="Canto Fictício" url="https://youtu.be/abcdefghijk" />);
    const toggle = screen.getByRole("button", { name: "Referência em vídeo" });
    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("complementary", { name: "Referência em vídeo" })).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("sem link válido, só a indicação compacta: nenhum botão nem player", () => {
    render(<VideoReference title="Canto Fictício" url="https://exemplo.test/video" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Sem vídeo de referência")).toBeDefined();
    expect(document.querySelector("iframe")).toBeNull();
  });
});
