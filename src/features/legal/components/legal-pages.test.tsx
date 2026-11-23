import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DataDeletionPage, { metadata as deletionMetadata } from "@/app/(app)/exclusao-de-dados/page";
import PrivacyPage, { metadata as privacyMetadata } from "@/app/(app)/privacidade/page";
import TermsPage, { metadata as termsMetadata } from "@/app/(app)/termos-de-uso/page";
import { SITE_PRIVACY_EMAIL, SITE_RESPONSIBLE_NAME, SITE_URL } from "@/lib/site";

const privateServices = vi.hoisted(() => ({ lookupSession: vi.fn(), getMongoClient: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ lookupSession: privateServices.lookupSession }));
vi.mock("@/server/database/mongodb-client", () => ({ getMongoClient: privateServices.getMongoClient }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("páginas públicas de informações e direitos", () => {
  const pages = [
    { path: "/privacidade", title: "Política de Privacidade", Page: PrivacyPage, metadata: privacyMetadata },
    { path: "/termos-de-uso", title: "Termos de Uso", Page: TermsPage, metadata: termsMetadata },
    { path: "/exclusao-de-dados", title: "Exclusão de conta e dados", Page: DataDeletionPage, metadata: deletionMetadata },
  ];

  it.each(pages)("$path abre sem sessão, configuração de autenticação ou banco", ({ Page, title }) => {
    for (const variable of ["MONGODB_URI", "MONGODB_DB_NAME", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "FACEBOOK_CLIENT_SECRET"]) {
      vi.stubEnv(variable, undefined);
    }
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeDefined();
    expect(screen.getByRole("article")).toBeDefined();
    expect(screen.getByText(SITE_RESPONSIBLE_NAME)).toBeDefined();
    expect(screen.getAllByRole("link", { name: SITE_PRIVACY_EMAIL }).every((link) => link.getAttribute("href") === `mailto:${SITE_PRIVACY_EMAIL}`)).toBe(true);
    expect(privateServices.lookupSession).not.toHaveBeenCalled();
    expect(privateServices.getMongoClient).not.toHaveBeenCalled();
  });

  it.each(pages)("$path declara endereço HTTPS público e permite indexação", ({ path, metadata }) => {
    expect(metadata.alternates).toEqual({ canonical: `${SITE_URL}${path}` });
    expect(String(metadata.alternates?.canonical)).toMatch(/^https:\/\//);
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it("prepara uma solicitação de exclusão ao canal real sem enviar ou apagar automaticamente", () => {
    render(<DataDeletionPage />);
    const link = screen.getByRole("link", { name: "Preparar solicitação por e-mail" });
    const href = link.getAttribute("href")!;
    expect(href).toMatch(/^mailto:me@alexparis\.dev\?/);
    expect(new URL(href).searchParams.get("subject")).toBe("Exclusão de conta e dados — Repertório Santa Cecília");
    expect(screen.getByText(/Não existe botão de eliminação automática/)).toBeDefined();
    expect(screen.getByText(/não envia nem registra pedidos automaticamente/)).toBeDefined();
    expect(screen.queryByRole("button", { name: /excluir|eliminar/i })).toBeNull();
    expect(document.querySelector("form")).toBeNull();
  });

  it("distingue instruções públicas de um callback Meta e da remoção da autorização externa", () => {
    render(<DataDeletionPage />);
    expect(screen.getByText(/não é um endpoint automático de exclusão da Meta/)).toBeDefined();
    expect(screen.getByText(/não elimina automaticamente os registros já mantidos aqui/)).toBeDefined();
    expect(screen.getByText(/conta pessoal na Meta/)).toBeDefined();
  });

  it("descreve os prestadores reais, dados sensíveis e direitos sem confundir biblioteca com acesso integral", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Vercel hospeda a aplicação/)).toBeDefined();
    expect(screen.getByText(/O Better Auth é a biblioteca/)).toBeDefined();
    expect(screen.getByText(/convicção religiosa/)).toBeDefined();
    expect(screen.getByText(/não substitui uma solicitação de acesso a todos os dados/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Lei Geral de Proteção de Dados" }).getAttribute("href")).toContain("planalto.gov.br");
  });

  it("considera direitos autorais e a diferença entre contribuição, biblioteca e publicação", () => {
    render(<TermsPage />);
    expect(screen.getByText(/não transfere automaticamente a autoria/)).toBeDefined();
    expect(screen.getByText(/não há aprovação automática/i)).toBeDefined();
    expect(screen.getByText(/e-mail da conta não é publicado automaticamente/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Política de Privacidade" }).getAttribute("href")).toBe("/privacidade");
  });
});
