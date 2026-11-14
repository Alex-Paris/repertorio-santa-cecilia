#!/usr/bin/env node
/**
 * Músicas fictícias e originais para desenvolvimento. Idempotente: insere só o que falta,
 * nunca altera nem apaga dados existentes, e não toca em músicas particulares. Uma música que
 * já existe não recebe classificação litúrgica por este comando.
 *
 *   pnpm catalog:seed
 */
import { withDatabase } from "./mongo-env.mjs";

if (process.env.NODE_ENV === "production") {
  console.error("Recusado: o seed do catálogo é só para desenvolvimento.");
  process.exit(1);
}

function normalize(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").trim();
}

function tokens(...values) {
  return [...new Set(values.flatMap((value) => normalize(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean)))];
}

const rights = (display, share, basis = "original-work") => ({
  basis,
  evidence: "Conteúdo fictício criado para o ambiente de desenvolvimento.",
  displayChordPro: display,
  shareChordPro: share,
  approvedBy: "seed-desenvolvimento",
  approvedAt: new Date("2026-11-01T00:00:00.000Z"),
});

/** Classificação litúrgica de exemplo. Os valores seguem os vocabulários do domínio. */
const liturgy = (fields) => ({
  category: "liturgical",
  moments: [],
  seasons: [],
  celebrations: [],
  themes: [],
  scripture: [],
  avoidSeasons: [],
  suitabilityNotes: "",
  editorialRationale: "Classificação de exemplo para o ambiente de desenvolvimento.",
  officialReference: "",
  classifiedBy: "seed-desenvolvimento",
  classifiedAt: new Date("2026-11-11T00:00:00.000Z"),
  ...fields,
});

const original = (id, title, artist, originalKey, chordPro, classification, share = true) => ({
  id,
  title,
  artist,
  originalKey,
  contentType: "original",
  chordPro,
  status: "published",
  rights: rights(true, share),
  liturgy: liturgy(classification),
});

/**
 * Cantos fictícios com classificação litúrgica (Etapa 2E.2). Títulos, letras e acordes foram
 * escritos para este projeto; nenhum texto litúrgico oficial é reproduzido. Por isso não há
 * exemplos de Glória, Santo, Cordeiro ou salmo responsorial: esses cantos têm texto próprio.
 */
const LITURGICAL_SONGS = [
  original(
    "liturgia-portas-abertas-da-manha",
    "Portas Abertas da Manhã",
    "Coral Fictício",
    "D",
    "[D]Abre as portas, é ma[A]nhã\n[Bm]Vem o povo reu[G]nido\n[D]Cada passo é can[A]ção\n[G]No caminho do Se[D]nhor",
    { moments: ["entrada"], themes: ["louvor", "alegria"], suitabilityNotes: "Para a procissão de entrada." },
  ),
  original(
    "liturgia-vigias-da-aurora",
    "Vigias da Aurora",
    "Grupo Imaginário",
    "Em",
    "[Em]Noite longa, [C]lâmpada acesa\n[G]Quem vigia es[D]pera o dia\n[Em]Vem, Senhor, não [C]tardes mais\n[G]Teu povo aguarda a au[D]rora",
    {
      moments: ["entrada"],
      seasons: ["advento"],
      themes: ["vigilancia", "esperanca"],
      scripture: [{ book: "mc", chapter: 13, verseStart: 33, verseEnd: 37 }],
    },
    // Exemplo de cifra que pode ser exibida, mas não redistribuída em links públicos.
    false,
  ),
  original(
    "liturgia-pao-e-vinho-do-nosso-chao",
    "Pão e Vinho do Nosso Chão",
    "Coral Fictício",
    "G",
    "[G]Trigo moído, [C]uva pisada\n[G]Fruto da terra e do [D]nosso suor\n[Em]Tudo o que temos [C]pomos na mesa\n[G]Recebe, Senhor, [D]o nosso lou[G]vor",
    { moments: ["preparacao-das-oferendas"], themes: ["gratidao"] },
  ),
  original(
    "liturgia-mesa-do-caminho",
    "Mesa do Caminho",
    "Banda Imaginária",
    "C",
    "[C]Quem tem fome encontra [F]pão\n[C]Quem tem sede encontra [G]vinho\n[Am]Nesta mesa do ca[F]minho\n[C]Ninguém [G]fica sozi[C]nho",
    {
      moments: ["comunhao"],
      themes: ["eucaristia", "amor-de-deus"],
      scripture: [{ book: "jo", chapter: 6, verseStart: 51, verseEnd: 58 }],
    },
  ),
  original(
    "liturgia-pastor-que-reina",
    "Pastor que Reina",
    "Grupo Imaginário",
    "A",
    "[A]Não governa com es[E]pada\n[F#m]Quem conhece cada o[D]velha\n[A]Seu reinado é cui[E]dado\n[D]Pasto verde, água [A]mansa",
    {
      moments: ["comunhao", "acao-de-gracas"],
      seasons: ["tempo-comum"],
      celebrations: ["cristo-rei"],
      themes: ["bom-pastor", "reino-de-deus"],
      scripture: [
        { book: "sl", chapter: 23 },
        { book: "ez", chapter: 34, verseStart: 11, verseEnd: 16 },
      ],
    },
  ),
  original(
    "liturgia-volta-coracao",
    "Volta, Coração",
    "Banda Imaginária",
    "Dm",
    "[Dm]Rasga o peito, não o [Gm]manto\n[C]Volta inteiro, cora[F]ção\n[Dm]Quem se perde no ca[Gm]minho\n[A]Tem em casa o per[Dm]dão",
    {
      moments: ["entrada", "comunhao"],
      seasons: ["quaresma"],
      themes: ["conversao", "misericordia", "perdao"],
      scripture: [{ book: "jl", chapter: 2, verseStart: 12, verseEnd: 13 }],
      suitabilityNotes: "Canto de temática penitencial, próprio da Quaresma.",
    },
  ),
  original(
    "liturgia-manha-do-terceiro-dia",
    "Manhã do Terceiro Dia",
    "Coral Fictício",
    "E",
    "[E]A pedra não se[A]gura\n[E]A luz que quer [B]nascer\n[C#m]Manhã do terceiro [A]dia\n[E]A vida tornou a [B]flores[E]cer",
    { moments: ["entrada", "encerramento"], seasons: ["pascoa"], themes: ["ressurreicao", "alegria"] },
  ),
  original(
    "liturgia-aleluia-das-colinas",
    "Aleluia das Colinas",
    "Grupo Imaginário",
    "G",
    "[G]Ale[C]lu[G]ia, ale[D]luia\n[Em]Fala, Senhor, que teu [C]povo escuta\n[G]Ale[D]lu[G]ia",
    {
      moments: ["aclamacao-ao-evangelho"],
      avoidSeasons: ["quaresma"],
      suitabilityNotes: "Contém o Aleluia: não é usada na Quaresma. O versículo é o do Lecionário do dia.",
    },
  ),
  original(
    "liturgia-ide-semeadores",
    "Ide, Semeadores",
    "Banda Imaginária",
    "D",
    "[D]A missa não ter[G]mina na porta\n[D]Começa na [A]rua\n[Bm]Ide, semea[G]dores\n[D]A pala[A]vra é [D]tua",
    { moments: ["encerramento"], themes: ["missao", "vocacao"] },
  ),
  original(
    "liturgia-rosas-de-maio",
    "Rosas de Maio",
    "Coral Fictício",
    "F",
    "[F]Rosas de maio na ja[Bb]nela\n[F]Uma prece em cada [C]flor\n[Dm]Mãe que guarda quem ca[Bb]minha\n[F]Ensina-nos [C]teu a[F]mor",
    {
      category: "devotional",
      themes: ["maria"],
      suitabilityNotes: "Canto devocional, para terços e encontros. Não é sugerido para a missa.",
    },
  ),
];

const SONGS = [
  {
    id: "catalogo-coracao-de-estrada",
    title: "Coração de Estrada",
    artist: "Banda Imaginária",
    originalKey: "G",
    contentType: "original",
    chordPro: "{title: Coração de Estrada}\n[G]Sigo a estrada [D]sem saber\n[Em]Onde o dia vai [C]nascer\n\n{chorus}\n[C]Coração de es[G]trada\n[D]Canta na madru[G]gada",
    status: "published",
    rights: rights(true, true),
  },
  {
    id: "catalogo-manha-de-serra",
    title: "Manhã de Serra",
    artist: "Coral Fictício",
    originalKey: "D",
    contentType: "original",
    chordPro: "[D]Neblina desce a [A]serra\n[Bm]Café passado na ja[G]nela",
    status: "published",
    // Pode aparecer no catálogo, mas não em links públicos de repertórios.
    rights: rights(true, false),
  },
  {
    id: "catalogo-ponte-de-papel",
    title: "Ponte de Papel",
    artist: "Duo Inventado",
    originalKey: "Am",
    contentType: "authorized",
    chordPro: "[Am]Uma ponte de pa[F]pel",
    status: "published",
    // Só metadados: a autorização não cobre a exibição da cifra.
    rights: rights(false, false, "license"),
  },
  {
    id: "catalogo-mar-de-dentro",
    title: "Mar de Dentro",
    artist: "Banda Imaginária",
    originalKey: "E",
    contentType: "external-link",
    sourceUrl: "https://example.com/cifras/mar-de-dentro",
    status: "published",
    rights: rights(false, false, "external-reference"),
  },
  {
    id: "catalogo-rascunho-do-ensaio",
    title: "Rascunho do Ensaio",
    artist: "Coral Fictício",
    originalKey: "C",
    contentType: "original",
    chordPro: "[C]Ainda em revi[G]são",
    status: "draft",
    rights: rights(true, true),
  },
];

await withDatabase(async (db, dbName) => {
  const collection = db.collection("catalog_songs");
  let inserted = 0;
  // As músicas de exemplo anteriores ficam sem classificação: nada é classificado por suposição.
  const all = [...SONGS, ...LITURGICAL_SONGS];

  for (const song of all) {
    const now = new Date();
    const result = await collection.updateOne(
      { id: song.id },
      {
        $setOnInsert: {
          ...song,
          revision: 1,
          searchTokens: tokens(song.title, song.artist),
          sortTitle: normalize(song.title).replace(/\s+/g, " "),
          createdAt: now,
          updatedAt: now,
          ...(song.status === "published" ? { publishedAt: now } : {}),
        },
      },
      { upsert: true },
    );
    inserted += result.upsertedCount;
  }

  console.log(`${dbName}: ${inserted} música(s) inserida(s); ${all.length - inserted} já existiam e não foram alteradas.`);
});
