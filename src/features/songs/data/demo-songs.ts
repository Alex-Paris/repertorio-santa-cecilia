import type { SongRecord } from "../domain/song";

/** Músicas e letras fictícias, escritas exclusivamente para demonstração. */
/** Exemplos das versões antigas. Hoje só identificam bibliotecas antigas e servem aos testes. */
export const demoSongs: SongRecord[] = [
  {
    id: "song-caminhos",
    title: "Caminhos",
    artist: "Banda Exemplo",
    originalKey: "G",
    contentType: "original",
    createdAt: "2026-01-12T14:00:00.000Z",
    updatedAt: "2026-03-02T18:30:00.000Z",
    chordPro: `{title: Caminhos}
{artist: Banda Exemplo}
{key: G}

{comment: Introdução}
[G] [D] [Em] [C]

{start_of_verse}
[G]Hoje vou se[D]guir
[Em]Por um novo [C]lugar
[G]Deixo a porta a[D]berta
[C]Pro sol po[D]der entrar
{end_of_verse}

{start_of_chorus}
[C]Caminhos que eu [G]não tracei
[D]Me levam pra [Em]onde sonhei
[C]Passo a passo eu [G]vou
[D]Cantando o que [G]sou
{end_of_chorus}`,
  },
  {
    id: "song-mare-de-setembro",
    title: "Maré de Setembro",
    artist: "Trio Demonstração",
    originalKey: "Am",
    contentType: "original",
    createdAt: "2026-01-20T10:15:00.000Z",
    updatedAt: "2026-02-11T09:00:00.000Z",
    chordPro: `{title: Maré de Setembro}
{artist: Trio Demonstração}
{key: Am}

{start_of_verse}
[Am]Barco pequeno no [F]fim da manhã
[C]Rede estendida, [G]cheiro de hortelã
[Am]A maré sobe e [F]leva o que ficou
[Dm7]Tudo que o vento [E7]já me contou
{end_of_verse}

{start_of_chorus}
[F]Volta, setem[G]bro, volta de [C]novo
[Am]Traz a alegria de [Dm]todo esse [E7]povo
{end_of_chorus}`,
  },
  {
    id: "song-luz-da-varanda",
    title: "Luz da Varanda",
    artist: "Duo Fictício",
    originalKey: "D",
    contentType: "authorized",
    createdAt: "2026-02-03T20:40:00.000Z",
    updatedAt: "2026-02-03T20:40:00.000Z",
    chordPro: `{title: Luz da Varanda}
{artist: Duo Fictício}
{key: D}

[D]Acendi a [A/C#]luz da varanda
[Bm]Pra você lem[G]brar de voltar
[D]O café ainda [A]morno na mesa
[G]E uma cadeira a te es[A]perar

{comment: Final}
[G]Fica mais um [A]pouco, [D]fica`,
  },
  {
    id: "song-estrada-de-terra",
    title: "Estrada de Terra",
    artist: "Autoria Própria",
    originalKey: "E",
    contentType: "original",
    createdAt: "2026-03-08T16:20:00.000Z",
    updatedAt: "2026-04-01T11:45:00.000Z",
    chordPro: `{title: Estrada de Terra}
{key: E}

{start_of_verse}
[E]Poeira no retro[B]visor
[C#m]Rádio chiando um [A]velho refrão
[E]Mais uma curva, [B]mais um calor
[A]Levo a viola e o [B7]meu coração
{end_of_verse}

{start_of_chorus}
[A]Quem tem estrada não [E]tem solidão
[A]Cada parada é [B7]uma canção
{end_of_chorus}`,
  },
  {
    id: "song-coracao-de-vento",
    title: "Coração de Vento",
    artist: "Banda Exemplo",
    originalKey: "C",
    contentType: "authorized",
    createdAt: "2026-03-21T08:05:00.000Z",
    updatedAt: "2026-03-21T08:05:00.000Z",
    chordPro: `{title: Coração de Vento}
{artist: Banda Exemplo}
{key: C}

[C]Coração de vento não [G/B]sabe parar
[Am]Bate na janela, [F]quer me carregar
[C]Pipa sem linha, [G]folha no ar
[F]Vou aonde o [G]dia me [C]levar`,
  },
  {
    id: "song-noite-no-cais",
    title: "Noite no Cais",
    artist: "Trio Demonstração",
    originalKey: "Bb",
    contentType: "external-link",
    sourceUrl: "https://example.com/cifras/noite-no-cais",
    createdAt: "2026-04-14T21:10:00.000Z",
    updatedAt: "2026-04-14T21:10:00.000Z",
  },
];
