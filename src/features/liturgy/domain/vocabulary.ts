/**
 * Vocabulários litúrgicos controlados. Momentos e tempos são definidos pelo rito e ficam
 * fechados no código; celebrações e temas são listas editoriais, ampliadas por revisão.
 */

/** Como o canto se relaciona com o rito (IGMR 37). */
export type MomentKind =
  /** O canto é o próprio rito, com texto fixo ou do Lecionário. */
  | "rite"
  /** O canto acompanha uma ação ritual. */
  | "accompanies"
  /** Canto facultativo. */
  | "optional";

export const LITURGICAL_MOMENTS = [
  { id: "entrada", label: "Entrada", to: "à Entrada", kind: "accompanies", igmr: "47-48" },
  { id: "ato-penitencial", label: "Ato penitencial", to: "ao Ato penitencial", kind: "rite", igmr: "51-52" },
  { id: "gloria", label: "Glória", to: "ao Glória", kind: "rite", igmr: "53" },
  { id: "salmo-responsorial", label: "Salmo responsorial", to: "ao Salmo responsorial", kind: "rite", igmr: "61" },
  {
    id: "aclamacao-ao-evangelho",
    label: "Aclamação ao Evangelho",
    to: "à Aclamação ao Evangelho",
    kind: "rite",
    igmr: "62-63",
  },
  {
    id: "preparacao-das-oferendas",
    label: "Preparação das oferendas",
    to: "à Preparação das oferendas",
    kind: "accompanies",
    igmr: "74",
  },
  { id: "santo", label: "Santo", to: "ao Santo", kind: "rite", igmr: "79b" },
  { id: "cordeiro-de-deus", label: "Cordeiro de Deus", to: "ao Cordeiro de Deus", kind: "rite", igmr: "83" },
  { id: "comunhao", label: "Comunhão", to: "à Comunhão", kind: "accompanies", igmr: "86-87" },
  { id: "acao-de-gracas", label: "Ação de graças", to: "à Ação de graças", kind: "optional", igmr: "88" },
  // A IGMR não prevê canto final; ele é costume pastoral.
  { id: "encerramento", label: "Encerramento", to: "ao Encerramento", kind: "optional", igmr: null },
] as const satisfies readonly {
  id: string;
  label: string;
  to: string;
  kind: MomentKind;
  igmr: string | null;
}[];

export type LiturgicalMomentId = (typeof LITURGICAL_MOMENTS)[number]["id"];
export const LITURGICAL_MOMENT_IDS = LITURGICAL_MOMENTS.map((moment) => moment.id) as [
  LiturgicalMomentId,
  ...LiturgicalMomentId[],
];

export const MOMENT_KIND_LABELS: Record<MomentKind, string> = {
  rite: "O canto é o próprio rito",
  accompanies: "O canto acompanha o rito",
  optional: "Canto facultativo",
};

export const LITURGICAL_COLORS = ["verde", "roxo", "branco", "vermelho", "roseo"] as const;
export type LiturgicalColor = (typeof LITURGICAL_COLORS)[number];

export const LITURGICAL_COLOR_LABELS: Record<LiturgicalColor, string> = {
  verde: "Verde",
  roxo: "Roxo",
  branco: "Branco",
  vermelho: "Vermelho",
  roseo: "Róseo",
};

export const LITURGICAL_SEASONS = [
  { id: "advento", label: "Advento", withArticle: "o Advento", color: "roxo" },
  { id: "natal", label: "Natal", withArticle: "o Natal", color: "branco" },
  { id: "quaresma", label: "Quaresma", withArticle: "a Quaresma", color: "roxo" },
  { id: "triduo-pascal", label: "Tríduo Pascal", withArticle: "o Tríduo Pascal", color: null },
  { id: "pascoa", label: "Páscoa", withArticle: "a Páscoa", color: "branco" },
  { id: "tempo-comum", label: "Tempo Comum", withArticle: "o Tempo Comum", color: "verde" },
] as const satisfies readonly {
  id: string;
  label: string;
  withArticle: string;
  /** Cor própria do tempo (IGMR 346). O Tríduo muda de cor a cada dia. */
  color: LiturgicalColor | null;
}[];

export type LiturgicalSeasonId = (typeof LITURGICAL_SEASONS)[number]["id"];
export const LITURGICAL_SEASON_IDS = LITURGICAL_SEASONS.map((season) => season.id) as [
  LiturgicalSeasonId,
  ...LiturgicalSeasonId[],
];

/** Celebrações com cantos próprios. Lista editorial: não é o calendário completo. */
export const LITURGICAL_CELEBRATIONS = [
  { id: "natal-do-senhor", label: "Natal do Senhor" },
  { id: "santa-maria-mae-de-deus", label: "Santa Maria, Mãe de Deus" },
  { id: "epifania", label: "Epifania do Senhor" },
  { id: "quarta-feira-de-cinzas", label: "Quarta-feira de Cinzas" },
  { id: "domingo-de-ramos", label: "Domingo de Ramos" },
  { id: "pascoa-do-senhor", label: "Páscoa do Senhor" },
  { id: "pentecostes", label: "Pentecostes" },
  { id: "santissima-trindade", label: "Santíssima Trindade" },
  { id: "corpus-christi", label: "Corpus Christi" },
  { id: "sagrado-coracao", label: "Sagrado Coração de Jesus" },
  { id: "nossa-senhora-aparecida", label: "Nossa Senhora Aparecida" },
  { id: "todos-os-santos", label: "Todos os Santos" },
  { id: "cristo-rei", label: "Cristo Rei" },
  { id: "imaculada-conceicao", label: "Imaculada Conceição" },
  { id: "santos", label: "Celebrações de santos" },
] as const satisfies readonly { id: string; label: string }[];

export type LiturgicalCelebrationId = (typeof LITURGICAL_CELEBRATIONS)[number]["id"];
export const LITURGICAL_CELEBRATION_IDS = LITURGICAL_CELEBRATIONS.map((celebration) => celebration.id) as [
  LiturgicalCelebrationId,
  ...LiturgicalCelebrationId[],
];

export const BIBLICAL_THEMES = [
  { id: "eucaristia", label: "Eucaristia" },
  { id: "misericordia", label: "Misericórdia" },
  { id: "perdao", label: "Perdão" },
  { id: "gratidao", label: "Gratidão" },
  { id: "conversao", label: "Conversão" },
  { id: "ressurreicao", label: "Ressurreição" },
  { id: "espirito-santo", label: "Espírito Santo" },
  { id: "bom-pastor", label: "Bom Pastor" },
  { id: "amor-de-deus", label: "Amor de Deus" },
  { id: "vocacao", label: "Vocação" },
  { id: "esperanca", label: "Esperança" },
  { id: "vigilancia", label: "Vigilância" },
  { id: "reino-de-deus", label: "Reino de Deus" },
  { id: "caridade", label: "Caridade" },
  { id: "louvor", label: "Louvor" },
  { id: "alegria", label: "Alegria" },
  { id: "paz", label: "Paz" },
  { id: "luz", label: "Luz" },
  { id: "encarnacao", label: "Encarnação" },
  { id: "maria", label: "Maria" },
  { id: "missao", label: "Missão" },
] as const satisfies readonly { id: string; label: string }[];

export type BiblicalThemeId = (typeof BIBLICAL_THEMES)[number]["id"];
export const BIBLICAL_THEME_IDS = BIBLICAL_THEMES.map((theme) => theme.id) as [BiblicalThemeId, ...BiblicalThemeId[]];

/** Nem toda música religiosa serve à celebração eucarística. */
export const SONG_USE_CATEGORIES = [
  {
    id: "liturgical",
    label: "Canto litúrgico",
    description: "Composto para a celebração; pode ser sugerido para momentos da missa.",
  },
  {
    id: "proper-text",
    label: "Canto com texto próprio de uma celebração",
    description: "Ligado ao texto de uma celebração ou leitura; só é sugerido nela.",
  },
  {
    id: "devotional",
    label: "Canto devocional",
    description: "Para devoções, encontros e oração pessoal; não é sugerido para a missa.",
  },
  {
    id: "general",
    label: "Música religiosa de uso geral",
    description: "Para apresentações e encontros; não é sugerida para a missa.",
  },
] as const satisfies readonly { id: string; label: string; description: string }[];

export type SongUseCategory = (typeof SONG_USE_CATEGORIES)[number]["id"];
export const SONG_USE_CATEGORY_IDS = SONG_USE_CATEGORIES.map((category) => category.id) as [
  SongUseCategory,
  ...SongUseCategory[],
];

/** Só estas categorias entram nas sugestões para a missa. */
export function isMassCategory(category: SongUseCategory): boolean {
  return category === "liturgical" || category === "proper-text";
}

function labelOf<T extends { id: string; label: string }>(list: readonly T[], id: string): string {
  return list.find((entry) => entry.id === id)?.label ?? id;
}

export const momentLabel = (id: string): string => labelOf(LITURGICAL_MOMENTS, id);
export const seasonLabel = (id: string): string => labelOf(LITURGICAL_SEASONS, id);
export const celebrationLabel = (id: string): string => labelOf(LITURGICAL_CELEBRATIONS, id);
export const themeLabel = (id: string): string => labelOf(BIBLICAL_THEMES, id);
export const categoryLabel = (id: string): string => labelOf(SONG_USE_CATEGORIES, id);

/** Posição do momento na missa; momentos desconhecidos vão para o fim. */
export function momentOrder(id: string | undefined): number {
  const index = LITURGICAL_MOMENTS.findIndex((moment) => moment.id === id);
  return index === -1 ? LITURGICAL_MOMENTS.length : index;
}
