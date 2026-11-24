import { fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";

import { MAX_VIDEO_START_SECONDS, parseYouTubeId, parseYouTubeStartSeconds, youTubeEmbedUrl, youTubeWatchUrl } from "../domain/video-reference";
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

  it("entende o início em segundos e em horas/minutos nos links compartilhados", () => {
    for (const [suffix, seconds] of [["?t=90", 90], ["?t=1m30s", 90], ["?start=45", 45], ["#t=1h2m3s", 3723], ["?t=0", 0]] as const) {
      expect(parseYouTubeStartSeconds(`https://youtu.be/abcdefghijk${suffix}`)).toBe(seconds);
    }
    for (const suffix of ["", "?t=-1", "?t=1.5", "?t=amanhã", `?t=${MAX_VIDEO_START_SECONDS + 1}`]) {
      expect(parseYouTubeStartSeconds(`https://youtu.be/abcdefghijk${suffix}`)).toBeNull();
    }
    expect(parseYouTubeStartSeconds("https://example.com/watch?v=abcdefghijk&t=90")).toBeNull();
  });

  it("encaminha o mesmo início ao player e ao link externo, solicitando autoplay apenas quando pedido", () => {
    const source = new URL(youTubeEmbedUrl("abcdefghijk", { startSeconds: 45, autoplay: true }));
    expect(source.searchParams.get("start")).toBe("45");
    expect(source.searchParams.get("autoplay")).toBe("1");
    expect(source.searchParams.get("playsinline")).toBe("1");
    expect(youTubeWatchUrl("abcdefghijk", 45)).toContain("&t=45");
    expect(youTubeEmbedUrl("abcdefghijk", { startSeconds: -1 })).not.toContain("start");
  });
});

describe("ouvir nos cartões", () => {
  it("mantém o player ativo após o replay de refs do Strict Mode", () => {
    render(<StrictMode><VideoReference variant="play" title="Canto" videoId="abcdefghijk" startSeconds={45} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "Ouvir Canto" }));
    expect(screen.getByTitle("Referência em vídeo: Canto").getAttribute("src")).toContain("start=45&autoplay=1");
  });

  it("um clique carrega o vídeo no tempo escolhido sem pedir um segundo clique", () => {
    render(<VideoReference variant="play" title="Canto Fictício" videoId="abcdefghijk" startSeconds={45} />);
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ouvir Canto Fictício" }));
    const frame = screen.getByTitle<HTMLIFrameElement>("Referência em vídeo: Canto Fictício");
    expect(frame.src).toContain("start=45&autoplay=1&playsinline=1");
    expect(frame.getAttribute("allow")).toContain("autoplay");
    expect(screen.getByRole("link", { name: /Abrir no YouTube/ }).getAttribute("href")).toContain("&t=45");
    expect(screen.queryByRole("button", { name: /Carregar vídeo/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Parar Canto Fictício" }));
    expect(document.querySelector("iframe")).toBeNull();
    expect(frame.getAttribute("src")).toBe("about:blank");
  });

  it("trocar de cartão interrompe a música anterior e mantém um único player", () => {
    render(<><VideoReference variant="play" title="Primeira" videoId="abcdefghijk" /><VideoReference variant="play" title="Segunda" videoId="lmnopqrstuv" startSeconds={90} /></>);
    fireEvent.click(screen.getByRole("button", { name: "Ouvir Primeira" }));
    const previous = screen.getByTitle<HTMLIFrameElement>("Referência em vídeo: Primeira");
    fireEvent.click(screen.getByRole("button", { name: "Ouvir Segunda" }));
    expect(previous.getAttribute("src")).toBe("about:blank");
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
    expect(screen.getByTitle("Referência em vídeo: Segunda").getAttribute("src")).toContain("start=90");
    expect(screen.getByRole("button", { name: "Ouvir Primeira" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("desmontar o cartão interrompe a mídia e remove o painel", () => {
    const { unmount } = render(<VideoReference variant="play" title="Canto" videoId="abcdefghijk" />);
    fireEvent.click(screen.getByRole("button", { name: "Ouvir Canto" }));
    const frame = screen.getByTitle<HTMLIFrameElement>("Referência em vídeo: Canto");
    unmount();
    expect(frame.getAttribute("src")).toBe("about:blank");
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("ocultar a página também interrompe a reprodução", () => {
    render(<VideoReference variant="play" title="Canto" videoId="abcdefghijk" />);
    fireEvent.click(screen.getByRole("button", { name: "Ouvir Canto" }));
    fireEvent(window, new Event("pagehide"));
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("não oferece um botão de ouvir para um vídeo ausente ou inválido", () => {
    render(<VideoReference variant="play" title="Canto" videoId="inválido" />);
    expect(screen.queryByRole("button")).toBeNull();
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
