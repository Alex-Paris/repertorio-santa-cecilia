import type { LiturgicalCelebrationContext, LiturgicalReading } from "./calendar";
import { LITURGICAL_MOMENTS, type LiturgicalMomentId } from "./vocabulary";

/** O que as normas dizem sobre um momento em uma celebração. */
export interface MomentGuidance {
  moment: LiturgicalMomentId;
  /** `omitted`: o canto não acontece nesta celebração, e nada é sugerido. */
  status: "sung" | "omitted";
  /** Orientação para quem escolhe o canto. */
  note: string | null;
  /** Número da Instrução Geral do Missal Romano em que a orientação se apoia. */
  igmr: string | null;
}

type RubricContext = Pick<LiturgicalCelebrationContext, "season" | "rank">;

/**
 * Glória (IGMR 53): nos domingos fora do Advento e da Quaresma, nas solenidades e festas.
 * Celebrações especiais mais solenes ficam a critério de quem preside e não são tratadas aqui.
 */
export function isGloriaSung({ season, rank }: RubricContext): boolean {
  if (rank === "solenidade" || rank === "festa") {
    return true;
  }
  return rank === "domingo" && season !== "advento" && season !== "quaresma";
}

/** Aleluia (IGMR 62): em todos os tempos, exceto na Quaresma. */
export function isAlleluiaSung({ season }: RubricContext): boolean {
  return season !== "quaresma";
}

export function findPsalm(context: Pick<LiturgicalCelebrationContext, "readings">): LiturgicalReading | null {
  return context.readings.find((reading) => reading.role === "psalm") ?? null;
}

export function getMomentGuidance(
  context: Pick<LiturgicalCelebrationContext, "season" | "rank" | "readings">,
  moment: LiturgicalMomentId,
): MomentGuidance {
  const igmr = LITURGICAL_MOMENTS.find((entry) => entry.id === moment)?.igmr ?? null;
  const guidance = (status: MomentGuidance["status"], note: string | null): MomentGuidance => ({
    moment,
    status,
    note,
    igmr,
  });

  switch (moment) {
    case "gloria":
      return isGloriaSung(context)
        ? guidance("sung", "Hino de texto fixo: não pode ser trocado por outro canto.")
        : guidance(
            "omitted",
            context.rank === "domingo"
              ? "O Glória não é cantado nos domingos do Advento e da Quaresma."
              : "O Glória é cantado nos domingos fora do Advento e da Quaresma, nas solenidades e nas festas.",
          );

    case "aclamacao-ao-evangelho":
      return isAlleluiaSung(context)
        ? guidance("sung", "Canta-se o Aleluia com o versículo indicado no Lecionário.")
        : guidance(
            "sung",
            "Na Quaresma não se canta o Aleluia: canta-se o versículo antes do Evangelho indicado no Lecionário.",
          );

    case "salmo-responsorial": {
      const psalm = findPsalm(context);
      return guidance(
        "sung",
        psalm
          ? `O salmo é o do Lecionário: ${psalm.citation}. Só são sugeridas músicas ligadas a esse texto.`
          : "O salmo é o do Lecionário. Ele ainda não foi conferido nesta base, por isso nada é sugerido aqui.",
      );
    }

    case "ato-penitencial":
    case "santo":
    case "cordeiro-de-deus":
      return guidance("sung", "Canto de texto fixo do rito: use o texto aprovado.");

    case "encerramento":
      return guidance("sung", "A Instrução Geral não prevê canto final; ele é um costume pastoral.");

    default:
      return guidance("sung", null);
  }
}
