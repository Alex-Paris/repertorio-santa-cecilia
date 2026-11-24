/** Somente metadados de teste. Não contém textos do Lecionário. */
export function upstreamLiturgy() {
  return {
    data: "10/01/2027", liturgia: "Batismo do Senhor, Festa", cor: "Branco",
    leituras: {
      primeiraLeitura: [{ referencia: "Is 42,1-4.6-7", texto: "texto-que-nao-pode-ser-importado" }],
      salmo: [{ referencia: "Sl 28(29),1a.2.3ac-4.3b.9b-10 (R. 11b)", refrao: "refrao-que-nao-pode-ser-importado" }],
      segundaLeitura: [{ referencia: "At 10,34-38" }], evangelho: [{ referencia: "Mc 1,7-11 (Jesus batizado por João)" }], extras: [] as unknown[],
    },
    oracoes: { coleta: "oracao-que-nao-pode-ser-importada" }, antifonas: { entrada: "antifona-nao-importada" },
  };
}
