import { celebrationInputSchema } from "../domain/celebration-record";
import { EDITORIAL_CELEBRATIONS, type EditorialCelebration } from "./editorial-celebrations";

/**
 * Dados para preencher o formulário, sem escrita nem aprovação automática.
 * A base inicial de importação permanece intacta. Só referências, nunca textos litúrgicos.
 */
const saintAndrew: EditorialCelebration = {
  id: "2026-11-30-santo-andre-apostolo",
  input: celebrationInputSchema.parse({
    date: "2026-11-30",
    country: "BR",
    scope: "universal",
    celebrationKey: "santo-andre-apostolo",
    massVariant: "principal",
    title: "Santo André, Apóstolo",
    rank: "festa",
    season: "advento",
    lectionaryCycle: { sunday: "B", weekday: null },
    liturgicalColor: { color: "vermelho", note: "Cor pela regra geral para festas dos apóstolos (IGMR 346b)." },
    readings: [
      { role: "first", citation: "Rm 10,9-18", ranges: [{ book: "rm", chapter: 10, verseStart: 9, verseEnd: 18 }] },
      { role: "psalm", citation: "Sl 18(19A),2-3.4-5 (R. 5a)", ranges: [{ book: "sl", chapter: 19, verseStart: 2, verseEnd: 5 }] },
      { role: "gospel", citation: "Mt 4,18-22", ranges: [{ book: "mt", chapter: 4, verseStart: 18, verseEnd: 22 }] },
    ],
    unverifiedReadings: [],
    celebrations: [],
    biblicalThemes: ["vocacao", "missao"],
    notes: [
      "Festa de Santo André, com leituras próprias. Não se aplica a 2ª leitura.",
      "Cor, tempo e ciclo aguardam conferência no calendário em uso no Brasil; a cor segue a regra geral da IGMR 346b.",
      "A referência do salmo foi comparada com o Lecionário de Portugal. Conferir a citação e o refrão no Lecionário brasileiro antes de aprovar.",
    ],
    sources: [
      {
        id: "vatican-news",
        provider: "Vatican News",
        documentTitle: "Palavra do dia — 30 de novembro de 2026",
        referenceUrl: "https://www.vaticannews.va/pt/palavra-do-dia/2026/11/30.html",
        accessedAt: "2026-11-24",
        jurisdiction: "universal",
        scope: ["title", "rank", "first", "gospel"],
        verificationStatus: "automated-comparison",
        note: "Comparação durante o desenvolvimento, sem revisão humana. O portal não fornece o salmo.",
      },
      {
        id: "liturgia-portugal",
        provider: "Secretariado Nacional de Liturgia — Portugal",
        documentTitle: "Lecionário santoral — novembro, 30 de novembro, pp. 364–366",
        referenceUrl: "https://liturgia.pt/leccionarios/santoral/7_11_Nov.pdf",
        accessedAt: "2026-11-24",
        jurisdiction: "other-country",
        scope: ["first", "psalm", "gospel"],
        verificationStatus: "automated-comparison",
        note: "Fonte de Portugal usada apenas para referências bíblicas, sem confirmar calendário, cor ou redação do Lecionário brasileiro.",
      },
    ],
  }),
};

export const CELEBRATION_PRESETS: readonly EditorialCelebration[] = [
  ...EDITORIAL_CELEBRATIONS,
  saintAndrew,
].sort((a, b) => a.input.date.localeCompare(b.input.date) || a.id.localeCompare(b.id));
