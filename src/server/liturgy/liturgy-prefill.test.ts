// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { computeProvenance } from "@/features/liturgy/domain/celebration-record";
import { upstreamLiturgy } from "@/test/liturgy-prefill-fixtures";

import { fetchLiturgyPrefill, normalizeLiturgyPrefill } from "./liturgy-prefill";

afterEach(() => vi.unstubAllGlobals());
const normalize = (data: unknown = upstreamLiturgy()) => normalizeLiturgyPrefill(data, "2027-01-10", "2026-11-24");

describe("consulta automática da liturgia", () => {
  it("prepara outra data e outro ano, com referências e fontes, sem copiar textos ou aprovar", () => {
    const preview = normalize();
    expect(preview.draft).toMatchObject({ date: "2027-01-10", title: "Batismo do Senhor", rank: "festa", season: "natal", lectionaryCycle: { sunday: "B", weekday: null } });
    expect(preview.draft.readings).toHaveLength(4);
    expect(preview.draft.readings[3].citation).toBe("Mc 1,7-11");
    const serialized = JSON.stringify(preview);
    expect(serialized).not.toMatch(/texto-que|refrao-que|oracao-que|antifona-nao|approval|reviewStatus/);
    const provenance = computeProvenance(preview.draft);
    expect(provenance.find((entry) => entry.field === "season")?.status).toBe("inference");
    expect(provenance.find((entry) => entry.field === "cycle")?.status).toBe("inference");
  });
  it("recusa resposta de outra data e payload fora do contrato", () => {
    expect(() => normalize({ ...upstreamLiturgy(), data: "10/01/2026" })).toThrow();
    expect(() => normalize({ ...upstreamLiturgy(), cor: "cor desconhecida" })).toThrow();
    expect(() => normalize({ erro: "não encontrada" })).toThrow();
  });
  it("não aproxima leitura ambígua nem troca um trecho desconhecido pelo salmo inteiro", () => {
    const data = upstreamLiturgy();
    data.leituras.primeiraLeitura[0].referencia = "Gn 1,1-2,2";
    data.leituras.salmo[0].referencia = "Sl 18(19A)";
    const preview = normalize(data);
    expect(preview.draft.unverifiedReadings).toEqual(["first", "psalm"]);
    expect(preview.draft.readings.map((entry) => entry.role)).toEqual(["second", "gospel"]);
    expect(preview.draft.sources[0].scope).not.toContain("psalm");
  });
  it("mantém grau desconhecido vazio, sem alegar que a fonte o confirma", () => {
    const preview = normalize({ ...upstreamLiturgy(), liturgia: "Celebração particular" });
    expect(preview.draft.rank).toBeNull();
    expect(preview.draft.sources[0].scope).not.toContain("rank");
  });
  it("reaproveita a chave existente da mesma celebração preparada", () => {
    const data = { ...upstreamLiturgy(), data: "30/11/2026", liturgia: "Santo André, Apóstolo, Festa", cor: "Vermelho" };
    expect(normalizeLiturgyPrefill(data, "2026-11-30", "2026-11-24").draft).toMatchObject({ celebrationKey: "santo-andre-apostolo", scope: "universal" });
  });
  it("explicita alternativas e recusa leituras adicionais que o modelo não comporta", () => {
    const data = upstreamLiturgy();
    data.leituras.evangelho.push({ referencia: "Mc 1,9-11" });
    expect(normalize(data).warnings.join(" ")).toContain("alternativas");
    data.leituras.extras.push({ referencia: "Gn 1,1-2,2" });
    expect(() => normalize(data)).toThrow(/leituras adicionais/);
  });
  it("consulta URL fixa com dia, mês e ano, sem cache ou credenciais", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(upstreamLiturgy()));
    vi.stubGlobal("fetch", fetchMock);
    await fetchLiturgyPrefill("2027-01-10");
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://liturgia.up.railway.app/v2/?dia=10&mes=01&ano=2027");
    expect(options).toMatchObject({ cache: "no-store", credentials: "omit", redirect: "error", headers: { Accept: "application/json" }, signal: expect.any(AbortSignal) });
    await expect(fetchLiturgyPrefill("http://localhost/admin")).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([404, 429, 500])("trata status externo %i sem devolver seu corpo", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ segredo: "conteudo-interno" }, { status })));
    await expect(fetchLiturgyPrefill("2027-01-10")).rejects.toMatchObject({ status: status === 404 ? 404 : 503 });
  });
  it("limita o tamanho real do corpo, inclusive sem Content-Length", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(" ".repeat(512 * 1024 + 1), { headers: { "content-type": "application/json" } })));
    await expect(fetchLiturgyPrefill("2027-01-10")).rejects.toMatchObject({ status: 503 });
  });
});
