import "server-only";

import { z } from "zod";

import { CELEBRATION_PRESETS } from "@/features/liturgy/data/celebration-presets";
import { isValidIsoDate, todayInBrazil, type CelebrationRank, type ReadingRole } from "@/features/liturgy/domain/calendar";
import { inferCalendar } from "@/features/liturgy/domain/calendar-inferences";
import { cleanScriptureCitation, parseScriptureCitation } from "@/features/liturgy/domain/parse-scripture-citation";
import { liturgyPrefillSchema, type LiturgyPrefill } from "@/features/liturgy/domain/prefill";
import { ApiError } from "@/server/http/api-error";

const SOURCE = "https://liturgia.up.railway.app/v2/";
const PROVIDER = "API Liturgia Diária — Dancrf (independente)";
const MAX_BYTES = 512 * 1024;
const reference = z.object({ referencia: z.string().trim().min(1).max(300) });
const upstreamSchema = z.object({
  data: z.string(), liturgia: z.string().trim().min(1).max(300), cor: z.string().max(30),
  leituras: z.object({
    primeiraLeitura: z.array(reference).max(8), salmo: z.array(reference).max(8),
    segundaLeitura: z.array(reference).max(8), evangelho: z.array(reference).min(1).max(8),
    extras: z.array(z.unknown()).max(20),
  }),
});

const plain = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const titleKey = (value: string) => plain(value).replace(/\b(solenidade|festa|memoria facultativa|memoria)\b/g, "").replace(/[ºª]/g, "").replace(/\b(d[aeo]s?|o|a)\b/g, "").replace(/[^a-z0-9]/g, "");

function rankInTitle(title: string): CelebrationRank | null {
  const text = plain(title);
  if (/\bsolenidade\b/.test(text)) return "solenidade";
  if (/\bfesta\b/.test(text)) return "festa";
  if (/\bmemoria facultativa\b/.test(text)) return "memoria-facultativa";
  if (/\bmemoria\b/.test(text)) return "memoria";
  if (/\bdomingo\b/.test(text)) return "domingo";
  if (/\bfeira\b|\bsabado\b/.test(text)) return "feria";
  return null;
}

function unavailable(): ApiError {
  return new ApiError(503, "internal_error", "Não foi possível consultar a liturgia agora. Tente novamente em instantes.");
}

/** Só metadados permitidos sobrevivem à validação; orações, textos e refrões são descartados. */
export function normalizeLiturgyPrefill(document: unknown, date: string, accessedAt: string): LiturgyPrefill {
  const parsed = upstreamSchema.safeParse(document);
  const expectedDate = date.split("-").reverse().join("/");
  if (!parsed.success || parsed.data.data !== expectedDate) throw unavailable();
  const data = parsed.data;
  if (data.leituras.extras.length) {
    throw new ApiError(422, "invalid_input", "Esta missa tem leituras adicionais que o preenchimento atual não comporta. Consulte a fonte e cadastre seus dados manualmente.");
  }
  const warnings = ["Fonte independente. Confira os dados no calendário e no Lecionário em uso no Brasil antes de aprovar.", "Tempo litúrgico e ciclo foram calculados por regras gerais e precisam de conferência."];
  const inferred = inferCalendar(date);
  const rank = rankInTitle(data.liturgia);
  const colors = { verde: "verde", roxo: "roxo", branco: "branco", vermelho: "vermelho", rosa: "roseo" } as const;
  const color = colors[plain(data.cor) as keyof typeof colors];
  if (!color) throw unavailable();
  const title = data.liturgia.replace(/,?\s*(?:Solenidade|Festa|Memória facultativa|Memória)\s*$/i, "").trim();
  const known = CELEBRATION_PRESETS.find((entry) => entry.input.date === date && titleKey(entry.input.title) === titleKey(title));
  const massVariant = /vig[ií]lia/i.test(title) ? "vigilia" : /missa (?:da )?noite/i.test(title) ? "noite" : /aurora/i.test(title) ? "aurora" : /missa do dia/i.test(title) ? "dia" : "principal";
  const sourceUrl = new URL(SOURCE);
  const [year, month, day] = date.split("-");
  sourceUrl.search = new URLSearchParams({ dia: day, mes: month, ano: year }).toString();
  const readings = [];
  const unverifiedReadings: ReadingRole[] = [];
  const notes: string[] = [];
  const roles = [["first", "primeiraLeitura"], ["psalm", "salmo"], ["second", "segundaLeitura"], ["gospel", "evangelho"]] as const;
  for (const [role, key] of roles) {
    const choices = data.leituras[key];
    if (!choices.length) {
      if (role !== "second") { unverifiedReadings.push(role); warnings.push(`A fonte não trouxe ${key === "salmo" ? "o salmo" : "a 1ª leitura"}. Confira este campo.`); }
      continue;
    }
    if (choices.length > 1) {
      notes.push(`Alternativas para ${key}: ${choices.map((choice) => cleanScriptureCitation(choice.referencia)).join("; ")}. O preenchimento usa a primeira opção.`);
      warnings.push(`Há alternativas para ${key}; confira a opção adequada à missa.`);
    }
    const citation = cleanScriptureCitation(choices[0].referencia);
    const ranges = parseScriptureCitation(citation);
    if (!ranges || citation.length > 120 || (role === "psalm" && ranges.some((range) => range.verseStart === undefined))) {
      unverifiedReadings.push(role);
      notes.push(`Referência de ${key} a conferir e estruturar manualmente: ${citation.slice(0, 300)}.`);
      warnings.push(`A referência de ${key} precisa ser preenchida manualmente; não foi aproximada.`);
    } else readings.push({ role, citation, ranges });
  }
  if (!rank) warnings.push("A fonte não informou o grau. Escolha-o antes de preencher o formulário.");
  const draft = {
    date, country: "BR" as const, scope: known?.input.scope ?? "national" as const,
    celebrationKey: known?.input.celebrationKey ?? plain(title).replace(/[ºª]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, ""),
    massVariant: known?.input.massVariant ?? massVariant, title,
    rank, season: inferred.season,
    lectionaryCycle: { sunday: inferred.cycle.sunday, weekday: rank === "feria" || rank === "memoria" || rank === "memoria-facultativa" ? inferred.cycle.weekday : null },
    liturgicalColor: { color }, readings, unverifiedReadings, celebrations: [], biblicalThemes: [],
    notes: [...warnings, ...notes],
    sources: [{
      id: "api-liturgia-diaria", provider: PROVIDER, documentTitle: `Liturgia de ${expectedDate} — metadados e referências`,
      referenceUrl: sourceUrl.toString(), accessedAt, jurisdiction: "BR" as const,
      scope: ["title", "color", ...(rank ? ["rank"] : []), ...readings.map((reading) => reading.role)],
      verificationStatus: "automated-comparison" as const,
      note: "Consulta automatizada a serviço independente, sem aprovação oficial ou conferência humana. Textos litúrgicos não foram importados.",
    }],
  };
  // As mesmas regras de salvamento valem na prévia. Grau ausente fica nulo até a escolha humana.
  const result = liturgyPrefillSchema.safeParse({ draft, warnings });
  if (!result.success) throw unavailable();
  return result.data;
}

async function readLimitedJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES || !response.body) {
    await response.body?.cancel();
    throw unavailable();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw unavailable();
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel(); }
}

/** Consulta explícita da administração: URL fixa, sem cookies, sem cache e sem escrita. */
export async function fetchLiturgyPrefill(date: string, signal?: AbortSignal): Promise<LiturgyPrefill> {
  if (!isValidIsoDate(date)) throw new ApiError(400, "invalid_input", "Informe uma data válida (AAAA-MM-DD).");
  const [ano, mes, dia] = date.split("-");
  const url = new URL(SOURCE);
  url.search = new URLSearchParams({ dia, mes, ano }).toString();
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" }, cache: "no-store", credentials: "omit", redirect: "error",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
    });
    if (response.status === 404) throw new ApiError(404, "not_found", "A fonte ainda não disponibilizou a liturgia desta data. Tente novamente mais tarde ou use o cadastro manual.", { reason: "celebration-not-covered" });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw unavailable();
    return normalizeLiturgyPrefill(await readLimitedJson(response), date, todayInBrazil());
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw unavailable();
  }
}
