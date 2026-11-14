# Catálogo editorial

Como o catálogo recebe músicas reais sem copiar conteúdo protegido: cadastro em etapas, músicas só com metadados, classificação com revisão humana, importação de metadados e diagnóstico das sugestões. Etapa 2E.4.

> **Nada aqui é oficial.** A classificação é do Repertório Web. Subsídios da CNBB e de dioceses orientam a classificação, mas não são licença de reprodução. O catálogo não guarda letra, cifra, partitura nem gravação sem autorização registrada.

## Cadastro em etapas

Em `/admin/catalogo/nova` (só administração). As etapas aparecem na mesma página, com navegação fixa no topo:

| Etapa | Campos | Obrigatório para o rascunho |
| --- | --- | --- |
| A. Identificação | Título, artista ou compositor, referência da composição, fontes consultadas (título, endereço, data) | Só o título |
| B. Conteúdo | Somente metadados, link para cifra externa ou cifra própria/autorizada; tom original | Tom só para cifra ou link |
| C. Classificação litúrgica | Tipo de uso, momentos, tempos, restrições, celebrações e temas (pesquisáveis), referências bíblicas, fonte de orientação, justificativa | Nada; aparece depois do rascunho |
| D. Direitos e revisão | Fundamento, evidência, permissões; conferência humana da classificação; publicação | Evidência só para publicar |

- O rascunho pode ficar incompleto. O que a fonte não confirma fica em branco: artista vazio aparece como "Autoria não informada"; tom vazio, como "Tom original não informado".
- Nenhum valor é suposto. Cifra própria e link externo exigem o tom real; sem ele, use "Somente metadados".
- Toda gravação mantém a revisão (`If-Match`) e a verificação do papel administrativo no banco.

## Música sem cifra

Novo tipo de conteúdo do catálogo, `metadata-only` (as músicas particulares e os backups não mudaram):

```ts
{ title, artist /* pode ser vazio */, originalKey? /* opcional */, contentType: "metadata-only" }
// chordPro e sourceUrl são recusados
```

Na interface pública:

| Situação | Lista e página da música |
| --- | --- |
| Cifra própria ou autorizada, com permissão de exibir | "Cifra disponível" |
| Link externo com permissão de mostrar o link | "Consultar cifra na fonte original" |
| Somente metadados, cifra sem permissão ou link sem permissão | "Cifra ainda não disponível" |

A página mostra a referência da composição e as "Fontes da identificação", com a observação de que não concedem direito de reprodução. Sem tom conhecido, não há transposição: o seletor de tom não aparece, e o servidor recusa transpor o item (400).

## Direitos por conteúdo

Cada permissão é separada e nenhuma vem da classificação:

| Uso | Onde fica | Regra |
| --- | --- | --- |
| Exibir metadados | Publicação | Toda música publicada; a publicação exige evidência registrada |
| Exibir letra e cifra | `rights.displayChordPro` | Só cifra própria ou autorizada |
| Redistribuir em links públicos | `rights.shareChordPro` | Exige também a exibição |
| Mostrar o link externo | `rights.linkExternalSource` | Ausente nas músicas antigas = permitido (comportamento anterior) |

O servidor força as permissões pelo tipo de conteúdo: música só com metadados nunca exibe nem redistribui cifra, mesmo que o pedido diga o contrário. Sem permissão para o link, a música aparece só com metadados na busca, na página, nas sugestões e nos links públicos (inclusive nos já publicados, conferidos a cada leitura). Fundamentos novos: `public-metadata` (somente metadados de fonte pública) e o já existente `external-reference`.

## Classificação e revisão humana

A classificação pode ser salva incompleta. O que falta aparece no editor e no relatório de qualidade:

- momento da missa (canto litúrgico ou texto próprio);
- celebração ou passagem do texto próprio;
- referência bíblica do salmo responsorial;
- justificativa editorial (interna);
- fonte de orientação (pública).

Estados (`liturgy.reviewStatus`):

| Estado | Como chega | Nas sugestões |
| --- | --- | --- |
| `pending_review` "Classificação não conferida" | Toda gravação, inclusive importação, e toda reclassificação | Entra, marcada como não conferida; o resultado fica provisório |
| `reviewed` "Classificação conferida" | Pessoa da administração, com classificação completa, fonte consultada e confirmação pessoal | Entra como conferida |
| `disputed` "Classificação com divergência" | Pessoa da administração registra a divergência (nota interna) | Não entra |

`POST /api/v1/admin/catalog/songs/:id/classification/review` com `If-Match`:

```json
{ "action": "approve", "humanReviewConfirmed": true, "source": "Hinário Litúrgico da CNBB, vol. 2" }
{ "action": "dispute", "note": "O subsídio indica para a entrada, não para a comunhão." }
{ "action": "resolve", "note": "Conferido de novo no subsídio." }
```

A conferência registra quem, quando e a fonte. O público vê a data e a fonte, nunca quem conferiu. Classificar ou importar nunca conta como conferência, e o título sozinho nunca é motivo de classificação.

## Prontidão para recomendação

O relatório `/admin/catalogo/qualidade` agrupa todas as músicas por situação:

| Situação | Significado |
| --- | --- |
| Sem classificação | Nenhuma classificação registrada |
| Classificação incompleta | Falta uma das partes acima, ou há contradição (mesmo tempo indicado e restrito; canto fora da missa com momentos) |
| Classificação não conferida | Completa, aguardando conferência humana |
| Com divergência editorial | Fora das sugestões até ser resolvida |
| Classificada fora da missa | Devocional ou de uso geral, completa |
| Pronta para recomendação | Completa, para a missa e conferida por uma pessoa |

Também mostra quantas músicas não têm cifra exibível. O relatório só aponta: nada é preenchido automaticamente.

## Importação de metadados

Em `/admin/catalogo/importar`. Formato `repertorio-web/catalogo-editorial`, versão 1, até 200 registros:

```json
{
  "format": "repertorio-web/catalogo-editorial",
  "version": 1,
  "records": [
    {
      "importKey": "cnbb-quaresma-b-senhor-deus-de-nossos-pais",
      "title": "Senhor, Deus de nossos pais",
      "artist": "…",
      "contentType": "metadata-only",
      "compositionReference": "…",
      "metadataSources": [{ "title": "…", "url": "https://…", "accessedAt": "2026-11-14" }],
      "classification": { "moments": ["entrada"], "seasons": ["quaresma"], "guidanceSource": "…", "editorialRationale": "…" }
    }
  ]
}
```

1. **Prévia** (`POST /api/v1/admin/catalog/import/preview`): valida cada registro, mostra as fontes e aponta o que é novo, já importado (mesma `importKey`), possível duplicata (mesmo título normalizado com autoria compatível, no arquivo ou no catálogo) ou inválido. Não grava nada.
2. **Confirmação** (`POST /api/v1/admin/catalog/import` com `"confirm": true`): refaz a prévia no servidor e cria rascunhos só para os registros novos.

Garantias:

- Só administração (anônimo 401, outras contas 403). Não há importação pública.
- Só `metadata-only` ou `external-link`. Letra, cifra, partitura e campos desconhecidos são recusados.
- Ao menos uma fonte por registro; endereços só `http(s)`.
- Cria apenas rascunhos, com fundamento `public-metadata` (ou `external-reference`), todas as permissões desligadas e a classificação como não conferida (`classifiedBy: "importacao-editorial"`).
- Idempotente: a `importKey` tem índice único parcial. Importar de novo não cria nem altera nada; músicas existentes nunca são modificadas.
- Nada é executado no banco por comando automático. A importação acontece só pela tela, por uma pessoa da administração, no banco a que a aplicação está ligada.

## Primeiro catálogo real

Arquivo `src/features/catalog/data/catalogo-editorial-inicial.json`, oferecido na tela de importação ("Usar o catálogo editorial inicial"). 30 registros, todos só com metadados (sem letra, cifra, partitura, gravação ou tom), consultados em 14/11/2026:

| Fonte | Registros | O que confirma |
| --- | --- | --- |
| [CNBB, "Diversos cantos para a Quaresma – Ano B"](https://www.cnbb.org.br/wp-content/uploads/2024/01/Outros-Cantos-para-Quaresma-Abertura-Ato-Penitencial-Aclamacao-Oferendas.pdf) | 13 | Título, autoria e a seção do subsídio (abertura, ato penitencial, aclamação, oferendas) |
| [Arquidiocese de Montes Claros, Fascículo do Advento 2025](https://arquimoc.org/wp-content/uploads/2025/11/Fasciculo-Advento-2025_compressed.pdf) | 9 | Título, autoria e o momento indicado no fascículo |
| [Arquidiocese de Goiânia, partitura do Hino da CF 2025](https://arquidiocesedegoiania.org.br/wp-content/uploads/2025/05/hino-da-cf-2025-fraternidade-e-ecologia-integral-0173627.pdf.pdf) | 1 | Título e autoria |
| [Portal Kairós, Hino da CF 2024](https://portalkairos.org/o-hino-da-campanha-da-fraternidade-2024/) | 1 | Título e autoria |
| Wikipédia (sequências e hinos tradicionais) | 6 | Título, autoria atribuída e a celebração a que a sequência pertence |

Cobertura: Quaresma (13 + 2 hinos da CF), Advento (9, inclusive a Imaculada Conceição), Páscoa e Pentecostes (sequências), Corpus Christi, Natal (2), Comunhão (5), Oferendas (7). 26 registros trazem classificação, 23 com momento; os 4 sem classificação (os dois hinos da CF e os dois natalinos) ficam pendentes, porque as fontes não fundamentam um momento da missa.

**Limites conhecidos:**

- A conferência foi feita por leitura automatizada das fontes, sem revisão humana. Tudo entra como rascunho e toda classificação como não conferida.
- As sequências (Páscoa, Pentecostes, Corpus Christi) estão ligadas à celebração, sem momento: o vocabulário atual não tem "sequência".
- O tom nunca é informado: nenhuma fonte de metadados o fixa.
- Os hinos da CF dependem do ano: a classificação ficou pendente de propósito.

## Recomendador

O algoritmo é o mesmo (restrições, depois celebração, leituras, tempo e temas; desempate por título). O que mudou:

- **Consulta seletiva:** o MongoDB só devolve candidatas publicadas, para a missa, do momento pedido, sem divergência, não restritas no tempo e que sejam do tempo, de uma celebração do dia ou sem tempo nem celebração (`listSuggestionCandidates`). O limite subiu para 2000 candidatas, e a ordem alfabética deixou de decidir quem entra.
- **Cobertura:** a resposta de sugestões traz `catalog: { published, classified, classifiedForMass }` e, por momento, `classifiedForMoment`. A tela distingue catálogo sem músicas, músicas sem classificação para a missa, momento sem nenhuma classificada e momento com classificadas, mas nenhuma adequada.
- **Conferência:** cada sugestão diz se a classificação foi conferida e se há cifra. Classificação não conferida torna o resultado provisório.
- **Diagnóstico:** `GET /api/v1/admin/liturgy/celebrations/:id/diagnostics` (só administração) devolve, por momento, quantas músicas estão classificadas, quantas são elegíveis, conferidas e com cifra, e quantas foram descartadas por regra. Aparece na página da celebração em `/admin/liturgia`. Usa as mesmas regras das sugestões.

## Exploração pública

`/catalogo` mostra "Explorar" na entrada (sem busca nem filtros): momentos, tempos, celebrações e temas que existem nas músicas publicadas, com a contagem. Cada caminho abre a busca já filtrada; os filtros se combinam com a busca por título ou artista e a paginação.

## Testes

- **Unitários:** classificação incompleta e conferência, prontidão, música só com metadados, direitos por conteúdo, link externo sem permissão, importação (formato, recusa de conteúdo, duplicatas, idempotência, catálogo inicial), diagnóstico, telas do cadastro, revisão, importação, exploração e estados vazios das sugestões.
- **Integração** (`tests/integration/catalog-editorial.test.ts`): rascunho parcial, publicação exige evidência, projeção pública, link restrito, repertório e link público com música sem cifra, conferência com `If-Match` e papel, divergência fora das sugestões, filtros combinados, cobertura, diagnóstico, importação (autorização, prévia sem gravar, confirmação, rascunhos, idempotência, duplicata, catálogo inicial) e as nove celebrações sem aprovação.
