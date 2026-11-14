import { createRepertoireItem, type RepertoireRecord } from "../domain/repertoire";

/** Repertórios fictícios. "Coração de Vento" aparece nos dois, com ordem e tom próprios. */
export const demoRepertoires: RepertoireRecord[] = [
  {
    id: "rep-sarau-de-domingo",
    name: "Sarau de Domingo",
    description: "Seleção tranquila para voz e violão em encontros pequenos.",
    createdAt: "2026-04-20T13:00:00.000Z",
    updatedAt: "2026-05-02T17:25:00.000Z",
    items: [
      createRepertoireItem({
        id: "item-sarau-caminhos",
        songId: "song-caminhos",
        position: 1,
        notes: "Abrir só com o violão.",
      }),
      createRepertoireItem({
        id: "item-sarau-luz",
        songId: "song-luz-da-varanda",
        position: 2,
        transposeSemitones: -2,
        notes: "Tom mais confortável para a segunda voz.",
      }),
      createRepertoireItem({
        id: "item-sarau-coracao",
        songId: "song-coracao-de-vento",
        position: 3,
      }),
      createRepertoireItem({
        id: "item-sarau-noite",
        songId: "song-noite-no-cais",
        position: 4,
      }),
    ],
  },
  {
    id: "rep-ensaio-acustico",
    name: "Ensaio Acústico",
    description: "Músicas em preparação para a próxima apresentação da banda.",
    createdAt: "2026-05-10T19:45:00.000Z",
    updatedAt: "2026-05-18T22:10:00.000Z",
    items: [
      createRepertoireItem({
        id: "item-ensaio-coracao",
        songId: "song-coracao-de-vento",
        position: 3,
        transposeSemitones: 2,
      }),
      createRepertoireItem({
        id: "item-ensaio-estrada",
        songId: "song-estrada-de-terra",
        position: 1,
        notes: "Entrada da percussão no refrão.",
      }),
      createRepertoireItem({
        id: "item-ensaio-mare",
        songId: "song-mare-de-setembro",
        position: 2,
      }),
    ],
  },
];
